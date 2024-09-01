// utils.js

const timeout = (millis) =>
    new Promise((resolve) => setTimeout(resolve, millis));
  
  const randomDelay = (minSeconds, maxSeconds) => {
    const minMilliseconds = minSeconds * 1000;
    const maxMilliseconds = maxSeconds * 1000;
    return Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;
  };
  
  module.exports = {
    timeout,
    randomDelay,
  };
  