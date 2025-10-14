# Health Check Endpoints

Сервис предоставляет несколько эндпоинтов для мониторинга состояния:

## Основные эндпоинты

### 1. `/health` - Базовый health check
**Назначение**: Проверка что сервис работает  
**Использование**: Kubernetes liveness probe, load balancer health check

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### 2. `/health/ready` - Readiness check
**Назначение**: Проверка готовности принимать трафик  
**Использование**: Kubernetes readiness probe

```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection is active",
      "responseTime": 15,
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "kafka": {
      "status": "healthy", 
      "message": "Kafka connection is active",
      "responseTime": 25,
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "priceUpdate": {
      "status": "healthy",
      "message": "Price update process is running normally",
      "responseTime": 10,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### 3. `/health/live` - Liveness check
**Назначение**: Проверка что сервис жив  
**Использование**: Kubernetes liveness probe

```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "service": {
      "status": "healthy",
      "message": "Service is running",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "memory": {
      "status": "healthy",
      "message": "Memory usage is normal (256MB)",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### 4. `/health/detailed` - Детальная информация
**Назначение**: Полная диагностика состояния сервиса  
**Использование**: Мониторинг, отладка

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "memory": {
    "rss": 123456789,
    "heapTotal": 45678912,
    "heapUsed": 23456789,
    "external": 1234567
  },
  "readiness": { /* readiness checks */ },
  "liveness": { /* liveness checks */ }
}
```

### 5. `/health/price-update` - Состояние обновления цен
**Назначение**: Мониторинг процесса обновления цен  
**Использование**: Специфичный мониторинг бизнес-логики

```json
{
  "status": "healthy",
  "message": "Price update process is running normally",
  "details": {
    "lastUpdate": "2024-01-15T10:29:45.000Z",
    "totalTokens": 1000,
    "processedTokens": 750,
    "processingProgress": 75.0,
    "isStuck": false
  },
  "statistics": {
    "total": 1000,
    "withPrice": 950,
    "recentlyUpdated": 800,
    "withoutPrice": 50,
    "stale": 150
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Статусы

- **healthy**: Компонент работает нормально
- **unhealthy**: Компонент не работает или недоступен
- **warning**: Компонент работает, но есть проблемы

## Использование в Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: token-price-service
spec:
  template:
    spec:
      containers:
      - name: token-price-service
        image: token-price-service:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Мониторинг

### Prometheus метрики
Можно добавить Prometheus метрики на основе health checks:

```typescript
// Пример метрики
const healthCheckDuration = new prometheus.Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks',
  labelNames: ['check_type', 'status']
});
```

### Grafana Dashboard
Создать дашборд с панелями:
- Общее состояние сервиса
- Состояние компонентов (DB, Kafka)
- Прогресс обновления цен
- Использование памяти
- Время отклика health checks

## Troubleshooting

### Проблемы с базой данных
```bash
curl http://localhost:3000/health/ready
# Проверить статус database check
```

### Проблемы с Kafka
```bash
curl http://localhost:3000/health/ready
# Проверить статус kafka check
```

### Застрявший процесс обновления цен
```bash
curl http://localhost:3000/health/price-update
# Проверить isStuck и processingProgress
```

## Настройка для множественных инстансов

При работе с множественными инстансами каждый инстанс будет показывать свое состояние. Для мониторинга кластера:

1. **Load Balancer**: Использует `/health/ready` для определения готовности
2. **Orchestrator**: Использует `/health/live` для определения живых инстансов  
3. **Monitoring**: Собирает метрики со всех инстансов через `/health/detailed`
