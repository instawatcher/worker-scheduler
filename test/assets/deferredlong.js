module.exports = (log) => new Promise((resolve) => {
  setTimeout(() => log('Look ma, I\'m still running!'), 3000);
  resolve(true);
});
