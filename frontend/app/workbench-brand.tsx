// Reference-based vector wordmark; use the original asset when supplied.
export default function WorkbenchBrand() {
  return <div className="workbench-brand">
    <svg viewBox="0 0 620 175" role="img" aria-label="Workbench by Paragon Corp">
      <path d="M20 39 C28 62 42 113 56 116 C70 120 85 67 97 58 C110 51 126 109 139 116 C151 121 170 66 178 42" fill="none" stroke="#0e3b63" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="150" cy="22" r="16" fill="#ffb82e"/>
      <text x="175" y="118" fill="#0e3b63" fontFamily="Arial, Helvetica, sans-serif" fontSize="94" fontWeight="800" letterSpacing="-4">orkbench</text>
      <text x="595" y="66" fill="#0e3b63" fontFamily="Arial, Helvetica, sans-serif" fontSize="19" fontWeight="700">™</text>
      <text x="185" y="163" fill="#0e3b63" fontFamily="Arial, Helvetica, sans-serif" fontSize="30" fontWeight="700">by Paragon Corp</text>
    </svg>
  </div>;
}
