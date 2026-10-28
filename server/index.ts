import { app } from './app.js'
import { config } from './config.js'
import { evaluateLowStock } from './services/alerts.js'

app.listen(config.PORT, () => {
  console.info(`INVOMECH API listening on http://localhost:${config.PORT}`)
  void evaluateLowStock().catch((error) => console.error('Low-stock evaluation failed', error))
})
setInterval(() => void evaluateLowStock().catch((error) => console.error('Low-stock evaluation failed', error)), 60 * 60 * 1000)
