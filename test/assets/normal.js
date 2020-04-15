module.exports = (log) => new Promise((resolve) => {
  log('hey, im here!');
  process.stdout.write('I\'m also here!');
  setTimeout(() => {
    resolve(true);
  }, 1000);
});
