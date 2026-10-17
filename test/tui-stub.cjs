// Unit tests exercise lifecycle behavior, not terminal rendering.
class Component { addChild() {} }
module.exports = { Box: Component, Spacer: Component, Text: Component };
