module.exports.foo = function() {
  return "foo";
};

module.exports.bar = function() {
  return "bar";
};

module.exports.x = function() {
  return module.exports.foo() + " " + module.exports.bar();
};
