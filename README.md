# Token Price Service Challenge

This repository contains a Node.js application implementing a Token Price Service with **modular architecture**, normalized database structure, and Kafka integration.

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Подробное описание архитектуры приложения
- **[MODULE_DIAGRAM.md](./MODULE_DIAGRAM.md)** - Визуальные диаграммы и схемы модулей
- **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** - Итоги рефакторинга и модуляризации
- **[CHALLENGE.md](./CHALLENGE.md)** - Техническое задание
- **[src/README.md](./src/README.md)** - Инструкции по запуску

## 🏗️ Модульная структура

Приложение организовано по **гибридному подходу** (домен + инфраструктура):

- **tokens/** - Домен: управление токенами, цепями, логотипами и ценами
  - `entities/` - TypeORM entities (Token, Chain, Logo)
  - `services/` - Бизнес-логика (TokenPriceUpdateService, MockPriceService, TokenSeederService)
  - `schemas/` - Zod validation schemas
  - `tokens.module.ts` - NestJS модуль

- **kafka/** - Инфраструктура: интеграция с Apache Kafka
  - `models/` - Kafka message models
  - `kafka-producer.service.ts` - Отправка сообщений
  - `kafka.module.ts` - NestJS модуль

- **database/** - База данных
  - `migrations/` - TypeORM миграции
  - `data-source.ts` - Конфигурация TypeORM
  - `seed.ts` - Standalone скрипт для заполнения БД

**test/** (вне src/) - E2E/Integration тесты

## Technology Stack

- **Node.js**: JavaScript runtime
- **TypeScript**: For type safety
- **Nest.js**: Node.js framework for building efficient and scalable server-side applications
- **PostgreSQL**: For data storage
- **TypeORM**: For database interactions
- **Kafka.js**: For message brokering
- **Jest**: For testing
- **Testcontainers**: For integration testing with Docker containers

## 🚀 Быстрый старт

### 1. Запустить зависимости (PostgreSQL, Kafka, Zookeeper)
```bash
docker-compose up -d
```

### 2. Установить зависимости
```bash
npm install
```

### 3. Запустить миграции
```bash
npm run migration:run
```

### 4. Запустить приложение
```bash
npm run start:dev
```

Приложение автоматически:
- ✅ Запустит миграции (если есть новые)
- ✅ Создаст начальные данные (3 токена: ETH, BTC, SOL)
- ✅ Запустит обновление цен каждые 5 секунд
- ✅ Отправит сообщения в Kafka топик `token-prices`

### Проверка работы

```bash
# Проверить данные в БД
docker exec token-price-postgres psql -U postgres -d tokens -c \
"SELECT t.symbol, t.price, c.name as chain FROM tokens t JOIN chains c ON t.chain_id = c.id;"

# Проверить Kafka топики
docker exec token-price-kafka kafka-topics --list --bootstrap-server localhost:9092
```

📖 **Подробные инструкции:** [src/README.md](./src/README.md)

## ✨ Features

- ✅ **Модульная архитектура** - чистое разделение на домен и инфраструктуру
- ✅ **Нормализованная БД (3NF)** - chains, logos, tokens с foreign keys
- ✅ **Автоматические миграции** - TypeORM migrations запускаются при старте
- ✅ **Периодическое обновление цен** - каждые 5 секунд
- ✅ **Kafka интеграция** - отправка сообщений при изменении цен
- ✅ **Типобезопасность** - TypeScript + Zod schemas
- ✅ **Точные цены** - DECIMAL(20,8) в БД, string в Node.js (без потери точности)
- ✅ **Integration тесты** - Testcontainers для PostgreSQL и Kafka
- ✅ **Docker Compose** - для локальной разработки
- ✅ **Graceful shutdown** - корректное завершение всех соединений

## License

This project is for educational purposes only.
