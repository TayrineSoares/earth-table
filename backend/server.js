const app = require('./app');

const PORT = process.env.PORT || 8080;

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
