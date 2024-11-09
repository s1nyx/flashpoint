# FlashPoint 🚀

A high-performance, production-ready HTTP server built with Node.js, designed for extreme scalability and minimal latency.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Clean Architecture](https://img.shields.io/badge/Clean%20Architecture-FF6B6B?style=flat-square)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## ✨ Features

- 🚄 **Ultra-High Performance**: Optimized for handling 100k+ requests per second
- 🎯 **Zero Dependencies**: Pure Node.js implementation for maximum control and performance
- 🔄 **Automatic Load Balancing**: Built-in clustering for optimal CPU utilization
- 💾 **Smart Caching**: Integrated response and route caching
- 🛡️ **Type Safety**: Written in TypeScript with strict type checking
- 🏗️ **Clean Architecture**: Domain-driven design with SOLID principles
- 🔌 **Graceful Shutdown**: Proper connection handling and cleanup

## 🚀 Performance Optimizations

- Pre-allocated buffer pools for request bodies
- Optimized TCP settings with Nagle's algorithm disabled
- Connection pooling and keep-alive optimization
- Route caching for faster lookups
- Header caching using WeakMap
- Minimal object allocation and GC pressure
- CPU pinning for worker processes

## 📋 Quick Start

```typescript
import { NodeHttpServer } from "flashpoint";

const bootstrap = async () => {
    const server = new NodeHttpServer();
    
    server.get('/health', async (req, res) => {
        res.status(200).send({ status: 'healthy' });
    });

    await server.listen(3000);
};

bootstrap().catch(console.error);
```

## 🏗️ Architecture

FlashPoint follows Clean Architecture principles with clear separation of concerns:

```
src/
├── core/ # Domain entities and business rules
├── application/ # Use cases and application logic
├── infrastructure/ # External interfaces (HTTP, Database)
└── shared/ # Shared utilities and errors
```

## 🧪 Development

### Test with autocannon

```bash 
npx autocannon -c 100 -d 30 http://localhost:3000/health
```

---

Made with ❤️ for the high-performance Node.js community.