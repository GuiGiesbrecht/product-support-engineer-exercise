/**
 * Records the GraphQL operation name on the Express response so the request
 * logger can persist it.
 *
 * Clients are not required to send `operationName` in the request body and the
 * console does not, so reading the body alone leaves `api_logs.operation_name`
 * empty for every request — and `/graphql` is exactly the path that needs it to
 * tell one request from another. By the time this hook runs the server has
 * parsed the document, so the name is available regardless of what the client
 * sent.
 */
module.exports = {
  async requestDidStart() {
    return {
      async didResolveOperation(requestContext) {
        const operation = requestContext.operation;
        const name =
          requestContext.operationName || (operation && operation.name && operation.name.value);
        if (name && requestContext.contextValue && requestContext.contextValue.res) {
          requestContext.contextValue.res.locals.operationName = name;
        }
      },
    };
  },
};
