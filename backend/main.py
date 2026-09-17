"""One local API, two independent saved-model engines. No training or persistence."""
import logging
import os
from threading import BoundedSemaphore

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from Hackathon.backend.schemas import FormulaSummary
from Hackathon.rescue import RescueValidationError
from ml.preprocess_mercurio import DISCLAIMER
from .predictor import load_rescue, load_sensory, rescue_versions
from .reformulation import optimize
from .schemas import RescueRequest, PredictRequest, OptimizeRequest, CatalogResponse, UnifiedRescueResponse, PredictionResponse, OptimizationResponse

logger=logging.getLogger('spontan.backend')
slots=BoundedSemaphore(2)
MAX_BODY=16*1024

def internal_failure(error, route):
    logger.error('Unhandled failure type=%s route=%s',type(error).__name__,route)
    return HTTPException(500,'Internal service error')

class BodyLimit:
    """Buffer at most 16 KiB before JSON/schema parsing, including chunked bodies."""
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or scope['method'] not in ('POST','PUT','PATCH'):
            return await self.app(scope,receive,send)
        headers=dict(scope.get('headers',[]))
        if headers.get(b'content-type',b'').split(b';')[0].strip().lower()!=b'application/json':
            return await JSONResponse({'detail':'Content-Type must be application/json'},status_code=415)(scope,receive,send)
        body=bytearray()
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            chunk=message.get('body',b'')
            if len(body)+len(chunk)>MAX_BODY:
                return await JSONResponse({'detail':'Payload exceeds 16 KiB'},status_code=413)(scope,receive,send)
            body.extend(chunk)
            if not message.get('more_body',False):break
        delivered=False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered=True
                return {'type':'http.request','body':bytes(body),'more_body':False}
            return await receive()
        await self.app(scope,replay,send)

app=FastAPI(title='Spontan Formulation API',version='0.1.0',description='Historical shampoo rescue and model-assisted emulsion search. '+DISCLAIMER)
app.add_middleware(BodyLimit)
origins=[origin.strip() for origin in os.getenv('CORS_ORIGINS','http://localhost:3000,http://127.0.0.1:3000').split(',') if origin.strip()]
if '*' in origins:raise ValueError('Exact CORS origins required')
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=['GET','POST'],allow_headers=['Content-Type'])

@app.exception_handler(RequestValidationError)
async def validation_error(request:Request,error:RequestValidationError):
    # Omit submitted values/ctx; NaN and secrets must not leak through validation errors.
    return JSONResponse({'detail':[{'loc':list(e['loc']),'type':e['type'],'msg':e['msg']} for e in error.errors()]},status_code=422)

@app.exception_handler(RescueValidationError)
async def rescue_error(request:Request,error:RescueValidationError):
    return JSONResponse({'detail':str(error)},status_code=422)

@app.exception_handler(ResponseValidationError)
async def response_error(request:Request,error:ResponseValidationError):
    # Broken server/model output is not a client input error; omit values/ctx.
    logger.error('Invalid response schema route=%s',request.url.path)
    return JSONResponse({'detail':'Internal service error'},status_code=500)

@app.exception_handler(Exception)
async def unexpected_error(request:Request,error:Exception):
    logger.error('Unhandled failure type=%s route=%s',type(error).__name__,request.url.path)
    return JSONResponse({'detail':'Internal service error'},status_code=500)

def rescue_dependency():
    try:return load_rescue()
    except Exception as error:
        logger.error('Rescue initialization failed type=%s',type(error).__name__)
        raise HTTPException(503,'Formula Rescue model unavailable') from None

def sensory_dependency():
    try:return load_sensory()
    except Exception as error:
        logger.error('Sensory initialization failed type=%s',type(error).__name__)
        raise HTTPException(503,'AI Reformulation model unavailable') from None

@app.get('/health',tags=['system'])
def health():return {'status':'ok','service':'Spontan Formulation API','disclaimer':DISCLAIMER}

@app.get('/ready',tags=['system'])
def ready():
    engines={}
    for name,loader in [('formula_rescue',load_rescue),('ai_reformulation',load_sensory)]:
        try:
            engine=loader()
            engines[name]={'status':'ready',**(rescue_versions() if name=='formula_rescue' else {'model_version':engine.metadata['model_version']})}
        except Exception as error:
            logger.error('Readiness failed engine=%s type=%s',name,type(error).__name__)
            engines[name]={'status':'unavailable'}
    complete=all(e['status']=='ready' for e in engines.values())
    return JSONResponse({'status':'ready' if complete else 'unavailable','engines':engines,'disclaimer':DISCLAIMER},status_code=200 if complete else 503)

@app.get('/formulas',response_model=CatalogResponse,tags=['formula-rescue'])
def formulas(offset:int=Query(default=0,ge=0),limit:int=Query(default=100,ge=1,le=100),engine=Depends(rescue_dependency)):
    ids=engine.stable_formula_ids();rows=[]
    for identifier in ids[offset:offset+limit]:
        row=engine.formula_summary(identifier);row['unavailable_ingredient_options']=engine.available_ingredients(identifier)
        rows.append(FormulaSummary.model_validate(row))
    return {'total':len(ids),'offset':offset,'limit':limit,'count':len(rows),'formulas':rows,'catalog_version':rescue_versions()['catalog_version']}

@app.post('/reformulate',response_model=UnifiedRescueResponse,tags=['formula-rescue'])
def rescue(payload:RescueRequest,engine=Depends(rescue_dependency)):
    try:
        return {**engine.reformulate(payload.formula_id,payload.constraint.ingredient,payload.top_k),**rescue_versions()}
    except RescueValidationError:
        raise
    except Exception as error:
        raise internal_failure(error,'/reformulate') from None

@app.post('/ai-reformulation/predict',response_model=PredictionResponse,tags=['ai-reformulation'])
def predict(payload:PredictRequest,predictor=Depends(sensory_dependency)):
    try:return predictor.predict(payload.composition.model_dump())
    except ValueError:raise HTTPException(422,'Predicted responses outside supported bounds') from None
    except Exception as error:raise internal_failure(error,'/ai-reformulation/predict') from None

@app.post('/ai-reformulation/optimize',response_model=OptimizationResponse,tags=['ai-reformulation'])
def reformulation(payload:OptimizeRequest,predictor=Depends(sensory_dependency)):
    if not slots.acquire(blocking=False):raise HTTPException(429,'Search capacity busy; retry later')
    try:
        return optimize(payload,predictor)
    except ValueError:raise HTTPException(422,'Baseline prediction outside supported bounds') from None
    except Exception as error:raise internal_failure(error,'/ai-reformulation/optimize') from None
    finally:slots.release()
