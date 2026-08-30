import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>Página no encontrada</h1>
      <p className="page-lede">
        Esta ruta no existe. Vuelve al inicio para continuar.
      </p>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </section>
  )
}
