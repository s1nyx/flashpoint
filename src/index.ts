import { NodeHttpServer } from "./infrastructure/http/http-server";


const bootstrap = async () => {
  const server = new NodeHttpServer();
  
  server.get('/health', async (req, res) => {
    res.status(200).send({ status: 'healthy' });
  });

  await server.listen(3000);
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Starting graceful shutdown...');
    await server.stop();
    process.exit(0);
  });
};

bootstrap().catch(console.error);