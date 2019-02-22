module.exports = {
  getNaturalizedInterval(interval) {
    return new Date().getTime() + (interval + this.getRandomInt(interval * 0.1, interval * 0.5));
  },

  getRandomInt(mn, mx) {
    const min = Math.ceil(mn);
    const max = Math.floor(mx);
    return Math.floor(Math.random() * (max - min)) + min;
  },
};
