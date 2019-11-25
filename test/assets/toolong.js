module.exports = (log) => new Promise((resolve) => {
  log('hey, im here!');
  setTimeout(() => {
    resolve(true);
  }, 5000);
});
