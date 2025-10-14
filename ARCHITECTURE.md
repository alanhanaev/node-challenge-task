# Архитектура приложения

## 🏗️ Модульная структура

Приложение организовано по гибридному подходу: домен + функциональность.

### Структура папок

```
src/
├── tokens/                    # Модуль токенов (домен)
│   ├── entities/             # TypeORM entities
│   │   ├── token.entity.ts
│   │   ├── chain.entity.ts
│   │   └── logo.entity.ts
│   ├── services/             # Бизнес-логика
│   │   ├── token-price-update.service.ts
│   │   ├── mock-price.service.ts
│   │   └── token-seeder.service.ts
│   ├── schemas/              # Zod validation schemas
│   │   ├── token.schema.ts
│   │   ├── chain.schema.ts
│   │   └── logo.schema.ts
│   └── tokens.module.ts      # Модуль NestJS
│
├── kafka/                     # Kafka модуль (инфраструктура)
│   ├── models/               # Kafka message models
│   │   └── token-price-update-message.ts
│   ├── kafka-producer.service.ts
│   └── kafka.module.ts
│
├── database/                  # Database модуль
│   ├── migrations/           # TypeORM migrations
│   │   ├── 1729635000000-NormalizeDatabase.ts
│   │   └── run-migrations.ts
│   ├── data-source.ts        # TypeORM DataSource config
│   └── seed.ts               # Standalone seed script
│
├── app.module.ts              # Root module
└── main.ts                    # Application entry point

test/                          # E2E/Integration tests (вне src/)
└── token-price-service.e2e-spec.ts
```

## 📦 Модули

### 1. TokensModule

**Назначение:** Управление токенами, их ценами и обновлениями

**Exports:**
- `TokenPriceUpdateService` - сервис обновления цен
- `TokenSeeder` - сервис для заполнения БД начальными данными

**Imports:**
- `TypeOrmModule.forFeature([Token, Chain, Logo])`
- `KafkaModule` - для отправки сообщений в Kafka

**Providers:**
- `TokenPriceUpdateService` - периодически обновляет цены токенов
- `MockPriceService` - генерирует случайные цены
- `TokenSeeder` - заполняет БД начальными данными

**Entities:**
- `Token` - основная сущность токена
- `Chain` - блокчейн сети (Ethereum, Bitcoin, Solana)
- `Logo` - логотипы токенов (big, small, thumb)

### 2. KafkaModule

**Назначение:** Интеграция с Apache Kafka

**Exports:**
- `KafkaProducerService` - для использования в других модулях

**Providers:**
- `KafkaProducerService` - отправка сообщений в Kafka

**Models:**
- `TokenPriceUpdateMessage` - модель сообщения о изменении цены

### 3. AppModule (Root)

**Назначение:** Корневой модуль приложения

**Imports:**
- `ConfigModule` - глобальная конфигурация
- `TypeOrmModule` - подключение к PostgreSQL
- `TokensModule` - модуль токенов
- `KafkaModule` - модуль Kafka

**Lifecycle Hooks:**
- `onModuleInit()` - инициализация: запуск seeder и price update service

## 🔄 Поток данных

1. **Инициализация:**
   ```
   AppModule.onModuleInit()
   ├── TokenSeeder.seed() → создаёт начальные данные
   └── TokenPriceUpdateService.start() → запускает таймер
   ```

2. **Обновление цен (каждые 5 секунд):**
   ```
   TokenPriceUpdateService.updatePrices()
   ├── MockPriceService.getRandomPriceForToken()
   ├── Обновление в БД (PostgreSQL)
   └── KafkaProducerService.sendMessage() → отправка в Kafka
   ```

3. **Kafka Message:**
   ```json
   {
     "tokenId": "uuid",
     "symbol": "ETH",
     "oldPrice": "3000.00000000",
     "newPrice": "3150.50000000",
     "percentageChange": 5.015,
     "timestamp": "2025-10-13T16:27:04.017Z"
   }
   ```

## 🗄️ База данных

### Нормализованная структура (3NF)

**chains** (блокчейн сети)
- `id` - UUID (PK)
- `name` - название сети
- `chain_id` - идентификатор сети (UNIQUE)
- `is_enabled` - активна ли сеть
- `created_at`, `updated_at`

**logos** (логотипы)
- `id` - UUID (PK)
- `big_path`, `small_path`, `thumb_path` - пути к файлам
- `created_at`, `updated_at`

**tokens** (токены)
- `id` - UUID (PK)
- `address` - адрес контракта (bytea)
- `symbol`, `name`, `decimals`
- `chain_id` - FK → chains (RESTRICT)
- `logo_id` - FK → logos (SET NULL)
- `price` - DECIMAL(20,8) → **хранится как string в Node.js**
- `last_price_update` - timestamp
- `created_at`, `updated_at`

### Преимущества нормализации:
- ✅ Нет дублирования данных chain и logo
- ✅ Целостность данных через FK constraints
- ✅ Простота обновления: изменение chain обновляет все токены
- ✅ Оптимизация: индексы на FK для быстрых JOIN

## 💡 Ключевые решения

### 1. Хранение цен как DECIMAL(20,8) → string

**Проблема:** JavaScript `number` (IEEE 754) теряет точность для больших/дробных чисел

**Решение:**
```typescript
// TypeORM Entity
@Column({ type: 'decimal', precision: 20, scale: 8 })
price: string; // ← НЕ number!

// Zod Schema
price: z.string().regex(/^\d+(\.\d{1,8})?$/)

// Mock Service
return price.toFixed(8); // ← возвращаем string
```

### 2. Миграции запускаются автоматически

```typescript
// app.module.ts
TypeOrmModule.forRoot({
  migrationsRun: true, // ← автоматический запуск
  synchronize: false,  // ← отключено (используем миграции)
})
```

### 3. Pattern для миграций

```typescript
// Только файлы заканчивающиеся на Migration
migrations: [__dirname + '/database/migrations/*Migration.{js,ts}']
// Исключает run-migrations.ts (standalone script)
```

## 🧪 Тестирование

### E2E/Integration Tests

**test/token-price-service.e2e-spec.ts**

Тестирует:
1. Обновление цены токена в БД
2. Отправку Kafka сообщения
3. Корректность данных в сообщении

Использует:
- Testcontainers для PostgreSQL, Zookeeper, Kafka
- Временные базы данных
- Kafka Consumer для проверки сообщений

## 📝 NPM Scripts

```bash
# Development
npm run start:dev           # Запуск с hot-reload

# Production
npm run build               # Сборка проекта
npm run start              # Запуск production версии

# Database
npm run migration:run      # Запуск миграций
npm run db:seed            # Заполнение БД данными

# Testing
npm run test               # Unit tests
npm run test:e2e           # Integration tests
```

## 🚀 Запуск проекта

### 1. Запуск зависимостей (PostgreSQL, Kafka, Zookeeper)
```bash
docker-compose up -d
```

### 2. Запуск миграций
```bash
npm run migration:run
```

### 3. Запуск приложения
```bash
npm run start:dev
```

Приложение автоматически:
1. ✅ Запустит миграции (если есть новые)
2. ✅ Создаст начальные данные (если БД пустая)
3. ✅ Запустит обновление цен каждые 5 секунд
4. ✅ Отправит сообщения в Kafka

## 🔍 Мониторинг

### Проверка данных в БД:
```bash
docker exec token-price-postgres psql -U postgres -d tokens -c \
"SELECT t.symbol, t.price, c.name as chain, t.last_price_update 
 FROM tokens t 
 JOIN chains c ON t.chain_id = c.id 
 ORDER BY t.symbol;"
```

### Проверка Kafka топиков:
```bash
docker exec token-price-kafka kafka-topics --list \
  --bootstrap-server localhost:9092
```

## 📚 Дополнительные материалы

- [CHALLENGE.md](./CHALLENGE.md) - техническое задание
- [README.md](./README.md) - общее описание проекта
- [src/README.md](./src/README.md) - описание source кода

