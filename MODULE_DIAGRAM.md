# Диаграмма модулей

## 📊 Архитектура модулей

```
┌─────────────────────────────────────────────────────────────┐
│                        AppModule                             │
│  (Root Module - координирует все модули)                    │
│                                                               │
│  Lifecycle:                                                   │
│  • onModuleInit()                                            │
│    ├─> TokenSeeder.seed()                                   │
│    └─> TokenPriceUpdateService.start()                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
  ┌──────────┐  ┌────────┐  ┌──────────┐
  │ Config   │  │TypeORM │  │ Tokens   │  KafkaModule
  │ Module   │  │ Module │  │ Module   │◄──────────┐
  └──────────┘  └────────┘  └─────┬────┘           │
                                   │                │
                                   │                │
                            ┌──────▼──────┐   ┌─────▼─────┐
                            │TokensModule │   │KafkaModule│
                            └──────┬──────┘   └─────┬─────┘
                                   │                │
        ┌──────────────────────────┼────────────────┼──────┐
        ▼                          ▼                ▼      ▼
   ┌─────────┐             ┌──────────────┐   ┌─────────┐
   │Entities │             │  Services    │   │Producer │
   └─────────┘             └──────────────┘   └─────────┘
```

## 🔄 Детальная структура модулей

### TokensModule (Домен: Токены)

```
┌───────────────────────────────────────────────────────────────┐
│                      TokensModule                              │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Imports:                                                      │
│  • TypeOrmModule.forFeature([Token, Chain, Logo])            │
│  • KafkaModule                                                │
│                                                                │
│  Providers:                                                    │
│  • TokenPriceUpdateService ─────────┐                        │
│  • MockPriceService                 │                        │
│  • TokenSeeder                      │                        │
│                                     │                        │
│  Exports:                           │                        │
│  • TokenPriceUpdateService          │                        │
│  • TokenSeeder                      │                        │
│                                     │                        │
└─────────────────────────────────────┼────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────┐
        │                             │                         │
        ▼                             ▼                         ▼
┌───────────────┐          ┌────────────────────┐      ┌─────────────┐
│   Entities    │          │     Services       │      │   Schemas   │
├───────────────┤          ├────────────────────┤      ├─────────────┤
│               │          │                    │      │             │
│ • token       │◄─────────┤ • token-price-     │      │ • token     │
│   .entity.ts  │          │   update.service   │      │   .schema   │
│               │          │                    │      │             │
│ • chain       │◄─────────┤ • mock-price       │      │ • chain     │
│   .entity.ts  │          │   .service         │      │   .schema   │
│               │          │                    │      │             │
│ • logo        │◄─────────┤ • token            │      │ • logo      │
│   .entity.ts  │          │   .seeder          │      │   .schema   │
│               │          │                    │      │             │
└───────────────┘          └──────────┬─────────┘      └─────────────┘
                                      │
                                      │ использует
                                      ▼
                            ┌───────────────────┐
                            │  KafkaProducer    │
                            │  Service          │
                            └───────────────────┘
```

### KafkaModule (Инфраструктура)

```
┌───────────────────────────────────────────────────────────────┐
│                      KafkaModule                               │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Providers:                                                    │
│  • KafkaProducerService                                       │
│                                                                │
│  Exports:                                                      │
│  • KafkaProducerService (для использования в других модулях)  │
│                                                                │
└──────────────────────────┬────────────────────────────────────┘
                           │
        ┌──────────────────┴────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│kafka-producer    │              │     Models       │
│.service.ts       │              ├──────────────────┤
├──────────────────┤              │                  │
│                  │              │ • token-price-   │
│ Methods:         │──────uses───►│   update-        │
│ • connect()      │              │   message.ts     │
│ • sendMessage()  │              │                  │
│ • disconnect()   │              │ Schema:          │
│                  │              │ Zod validation   │
└─────────┬────────┘              └──────────────────┘
          │
          │ отправляет в
          ▼
    ┌──────────┐
    │  Kafka   │
    │  Broker  │
    └──────────┘
```

### Database Module (Инфраструктура)

```
┌───────────────────────────────────────────────────────────────┐
│                    database/ (не модуль NestJS)               │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Standalone scripts для работы с БД вне NestJS контекста      │
│                                                                │
└──────────────────────────┬────────────────────────────────────┘
                           │
        ┌──────────────────┼────────────────┐
        │                  │                │
        ▼                  ▼                ▼
┌──────────────┐  ┌─────────────┐  ┌─────────────┐
│data-source.ts│  │   seed.ts   │  │ migrations/ │
├──────────────┤  ├─────────────┤  ├─────────────┤
│              │  │             │  │             │
│ TypeORM      │  │ Standalone  │  │ • 1729635.. │
│ DataSource   │  │ seeding     │  │   Normalize │
│              │  │ script      │  │   Database  │
│ Config:      │  │             │  │             │
│ • entities   │  │ Использует: │  │ • run-      │
│ • migrations │  │ • AppData   │  │   migrations│
│ • database   │  │   Source    │  │   .ts       │
│              │  │ • Token     │  │             │
└──────────────┘  │   Seeder    │  └─────────────┘
                  └─────────────┘
```

## 🔄 Поток данных при обновлении цены

```
┌────────────────────────────────────────────────────────────────────┐
│                   Цикл обновления цены (каждые 5 сек)             │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   setInterval (5 sec)    │
                    └──────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ TokenPriceUpdateService        │
              │   .updatePrices()              │
              └────────────┬───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌────────────────┐  ┌──────────────┐
│ Получить все │  │ Для каждого    │  │ Создать      │
│ токены из БД │─►│ токена:        │─►│ Kafka        │
│              │  │                │  │ сообщение    │
│ Repository   │  │ • MockPrice    │  │              │
│ .find()      │  │   .getRandom() │  │ create       │
│              │  │                │  │ TokenPrice   │
│              │  │ • Сохранить    │  │ UpdateMsg    │
└──────────────┘  │   в БД         │  └──────┬───────┘
                  │                │         │
                  │ • Вычислить    │         │
                  │   % изменения  │         │
                  └────────────────┘         │
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │ KafkaProducerService     │
                              │   .sendMessage()         │
                              └──────────┬───────────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │   Kafka     │
                                  │   Topic:    │
                                  │   token-    │
                                  │   prices    │
                                  └─────────────┘
```

## 💾 Структура данных (БД)

```
┌──────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                            │
└──────────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   chains    │    │    logos    │    │   tokens    │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ id (PK)     │    │ id (PK)     │    │ id (PK)     │
│ name        │◄───┤ big_path    │◄───┤ chain_id(FK)│
│ chain_id    │    │ small_path  │    │ logo_id(FK) │
│ is_enabled  │    │ thumb_path  │    │ address     │
│ created_at  │    │ created_at  │    │ symbol      │
│ updated_at  │    │ updated_at  │    │ name        │
└─────────────┘    └─────────────┘    │ decimals    │
      ▲                                │ price       │
      │                                │ (DECIMAL)   │
      │                                │ ...         │
      └────────────────────────────────┤             │
                 FOREIGN KEYS          └─────────────┘

Связи:
• tokens.chain_id → chains.id (RESTRICT)
• tokens.logo_id → logos.id (SET NULL)

Индексы:
• IDX_tokens_chain (chain_id)
• IDX_tokens_logo (logo_id)
• IDX_tokens_symbol (symbol)
• UQ_tokens_chain_address (chain_id, address) - UNIQUE
```

## 🎯 Зависимости между модулями

```
┌────────────────────────────────────────────────────────────┐
│                    Граф зависимостей                        │
└────────────────────────────────────────────────────────────┘

                    AppModule (root)
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
      ConfigModule   TypeORM    TokensModule
      (global)       Module          │
                                     │
                                     │ imports
                                     ▼
                               KafkaModule
                                     
Правила:
✅ TokensModule импортирует KafkaModule
✅ KafkaModule не зависит от других доменных модулей
✅ ConfigModule - глобальный (доступен везде)
❌ Циклических зависимостей нет
```

## 📦 Экспорт/Импорт сервисов

```
┌─────────────────────────────────────────────────────────────┐
│                 Что экспортируется из модулей                │
└─────────────────────────────────────────────────────────────┘

TokensModule exports:
├── TokenPriceUpdateService    (используется в AppModule)
└── TokenSeeder                (используется в AppModule)

KafkaModule exports:
└── KafkaProducerService       (используется в TokensModule)

AppModule:
├── Инициализирует всё приложение
└── Вызывает TokenSeeder и TokenPriceUpdateService в onModuleInit
```

## 🧪 Тестирование модулей

```
┌─────────────────────────────────────────────────────────────┐
│              E2E/Integration Test Structure                  │
└─────────────────────────────────────────────────────────────┘

Test Module (test/token-price-service.e2e-spec.ts):
├── TypeOrmModule (тестовая БД в Testcontainer)
├── Все providers из TokensModule
└── Все providers из KafkaModule

Testcontainers:
├── PostgreSQL (временный)
├── Zookeeper (временный)
└── Kafka (временный)

Проверяет:
✅ Обновление цены в БД
✅ Отправку Kafka сообщения
✅ Корректность данных
✅ Взаимодействие модулей
```

## 🚀 Lifecycle приложения

```
1. main.ts
   └─> NestFactory.create(AppModule)

2. AppModule инициализация
   ├─> ConfigModule.forRoot()
   ├─> TypeOrmModule.forRoot()
   │   └─> Миграции запускаются автоматически (migrationsRun: true)
   ├─> TokensModule
   │   ├─> TypeOrmModule.forFeature([Token, Chain, Logo])
   │   └─> KafkaModule
   │       └─> KafkaProducerService создаётся
   └─> Все providers создаются

3. AppModule.onModuleInit()
   ├─> TokenSeeder.seed()
   │   ├─> Проверка: есть ли уже данные?
   │   ├─> Если нет → создать chains, logos, tokens
   │   └─> Если да → пропустить
   └─> TokenPriceUpdateService.start()
       └─> setInterval каждые 5 секунд

4. Приложение работает
   └─> Каждые 5 сек: обновление цен + Kafka messages

5. Graceful shutdown
   ├─> TokenPriceUpdateService.onModuleDestroy()
   │   └─> clearInterval()
   └─> KafkaProducerService.onModuleDestroy()
       └─> producer.disconnect()
```

