module.exports = (log) => new Promise((resolve) => {
  log('hey, im here!');
  console.log('I\'m also here!'); // eslint-disable-line no-console
  setTimeout(() => {
    resolve(true);
  }, 1000);
});
