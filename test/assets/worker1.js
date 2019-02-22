module.exports = log => new Promise((resolve) => {
  log('hey, im here!');
  setTimeout(() => {
    resolve();
  }, 2000);
});
