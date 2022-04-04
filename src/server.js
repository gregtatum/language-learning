const express = require('express');
// @ts-ignore
require('dotenv').config();

const app = express();
const host = process.env.HOST;
const port = process.env.PORT;
if (!host) {
  throw new Error('.env requires a HOST');
}
if (!port) {
  throw new Error('.env requires a PORT');
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port http://${host}:${port}`);
});
