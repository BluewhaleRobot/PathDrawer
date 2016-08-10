// 从 world position buffer 中解析出具体的三维坐标
var getPosition = (worldPos) => {
  var buf = worldPos['data']['buffer'];
  return {
    'x': buf.readFloatLE(0),
    'y': buf.readFloatLE(4),
    'z': buf.readFloatLE(8)
  }
}

module.exports = {
  'getPosition': getPosition,
}
