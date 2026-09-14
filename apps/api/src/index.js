const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const {
  ApolloServerPluginLandingPageLocalDefault,
} = require('@apollo/server/plugin/landingPage/default');

const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const operationNamePlugin = require('./graphql/operationNamePlugin');
const { userFromRequest } = require('./lib/auth');
const requestLogger = require('./lib/requestLogger');
const authRoutes = require('./routes/auth');
const exportRoutes = require('./routes/export');
const internalRoutes = require('./routes/internal');

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(async (req, _res, next) => {
    req.user = await userFromRequest(req);
    next();
  });
  app.use(requestLogger);

  app.use('/auth', authRoutes);
  app.use('/export', exportRoutes);
  app.use('/internal', internalRoutes);

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true }), operationNamePlugin],
  });
  await apollo.start();
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req, res }) => ({ user: req.user, res }),
    })
  );

  app.listen(PORT, () => {
    console.log(`api listening on :${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
