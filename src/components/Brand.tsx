export const APP_NAME = 'Log_on'
export const APP_TAGLINE = 'Logistic on-line'

export default function Brand() {
  return (
    <div className="brand">
      <img className="brand-logo" src="/logo-white.png" alt="Log_on 로고" />
      <h1>{APP_NAME}</h1>
    </div>
  )
}
