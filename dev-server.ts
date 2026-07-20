import app from './api/_app';

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server successfully running on port http://localhost:${PORT}`);
});
