export interface FxIconProps extends React.SVGProps<SVGSVGElement> {
  className: string
}

export function FxIcon({ className, ...props }: FxIconProps) {
  return (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      role='img'
      aria-label='FX italic icon'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      {...props}
    >
      <g
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        transform='translate(2 4) skewX(-12)'
      >
        <path d='M3 2v12M3 2h7M3 8h6' />
        <path d='M13 2l8 12M21 2l-8 12' />
      </g>
    </svg>
  )
}
