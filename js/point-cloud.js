var glUtils = require('./webgl-utils');
var $ = require('./jquery.js');

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}

// Fill the buffer with the values that define a rectangle.
function setRectangle(gl, x, y, width, height) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2]), gl.STATIC_DRAW);
}

var gl;
var resolutionLocation;
var colorLocation;
var translationLocation;
var rotationLocation;
var scaleLocation;
var translation;
var rotation;
var scale;
var canvas = document.getElementById("canvas");
var textCanvas = document.getElementById("text-canvas");
var ctx2d = textCanvas.getContext("2d");
var leftPos = 0;
var topPos = 0;
var eventFlag = true;

// mouse position related
var mouseX = null;
var mouseY = null;

document.addEventListener('mousemove', onMouseUpdate, false);
document.addEventListener('mouseenter', onMouseUpdate, false);

function onMouseUpdate(e) {
    mouseX = e.pageX - canvas.offsetLeft;
    mouseY = e.pageY - canvas.offsetTop;
}

function getMouseX() {
    return mouseX;
}

function getMouseY() {
    return mouseY;
}

var initCanvas = ()=> {
  // Get A WebGL context
  $('.canvas-result')[0].width = $('.canvas-result').width();
  $('.canvas-result')[0].height = $('.canvas-result').height();
  textCanvas.width = $(textCanvas).width();
  textCanvas.height = $(textCanvas).height();
  gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // setup GLSL program
  var program = glUtils.createProgramFromScripts(gl, ["2d-vertex-shader", "2d-fragment-shader"]);
  gl.useProgram(program);

  // lookup uniforms
  resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  colorLocation = gl.getUniformLocation(program, "u_color");
  translationLocation = gl.getUniformLocation(program, "u_translation");
  rotationLocation = gl.getUniformLocation(program, "u_rotation");
  scaleLocation = gl.getUniformLocation(program, "u_scale");

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  translation = [0, 0];
  rotation = [0, 1];
  scale = [1, 1];
  // set the resolution
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  // Set the translation.
  gl.uniform2fv(translationLocation, translation);
  // Set the rotation.
  gl.uniform2fv(rotationLocation, rotation);
  // Set the scale.
  gl.uniform2fv(scaleLocation, scale);
  // Create a buffer.
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  var moveFlag = false;

  // set canvas events
  canvas.addEventListener('mousedown', (evt)=>{
    if(!eventFlag)
      return;
    moveFlag = true;
  });

  canvas.addEventListener('mouseup', (evt)=>{
    moveFlag = false;
  });

  canvas.addEventListener('mousemove', (evt)=>{
    if(!moveFlag || !eventFlag)
      return;
    translation[0] += evt.movementX;
    translation[1] += evt.movementY;
    leftPos -= evt.movementX;
    topPos -= evt.movementY;
    drawScene();
  })

  var resizeProcessFlag = false;
  window.addEventListener('resize', (evt)=>{
    if(resizeProcessFlag)
      return;
    resizeProcessFlag = true;
    var currentWidth = $('.canvas-result').width();
    var currentHeight = $('.canvas-result').height();
    $('.canvas-result')[0].width = currentWidth;
    $('.canvas-result')[0].height = currentHeight;
    textCanvas.width = currentWidth;
    textCanvas.height = currentHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    drawScene();
    resizeProcessFlag = false;
  });

  window.addEventListener('wheel', (evt)=>{
    if(!eventFlag)
      return;
    var previousScale = [scale[0], scale[1]];
    if(evt.wheelDelta > 0){
      scale[0] *= 2;
      scale[1] *= 2;
    }
    if(evt.wheelDelta < 0){
      scale[0] *= 0.5;
      scale[1] *= 0.5;
    }
    // 计算不动点的坐标位置
    var pointPosLeft = leftPos + getMouseX();
    var pointPosTop = topPos + getMouseY();
    // 计算当前点的偏移量
    translation[0] -= (scale[0]/previousScale[0] - 1) * pointPosLeft;
    translation[1] -= (scale[1]/previousScale[1] - 1) * pointPosTop;
    // 计算新的左上角坐标

    leftPos = pointPosLeft / previousScale[0] * scale[0] - getMouseX();
    topPos = pointPosTop / previousScale[1] * scale[1] - getMouseY();
    drawScene();
  });
}

var pointBuf = [];
var drawObjs = [];
var drawObjsId = 0;

var canvas = document.getElementById("canvas");
var drawScene = () => {
  // Clear the canvas.
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

  // Set the translation.
  gl.uniform2fv(translationLocation, translation);

  // Set the rotation.
  gl.uniform2fv(rotationLocation, rotation);

  // Set the scale.
  gl.uniform2fv(scaleLocation, scale);

  // Draw the geometry.
  for(let pointIndex in pointBuf){
    if(pointBuf[pointIndex] == null)
      continue;
    let posX = pointBuf[pointIndex].posX;
    let posY = pointBuf[pointIndex].posY;
    let r = pointBuf[pointIndex].r;
    let g = pointBuf[pointIndex].g;
    let b = pointBuf[pointIndex].b;
    setRectangle(
        gl, posX, posY, 2/scale[0], 2/scale[1]);
    gl.uniform4f(colorLocation, r, g, b, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  for(let drawIndex in drawObjs){
    let tempPointBuf = drawObjs[drawIndex]['points'];
    for(let pointIndex in tempPointBuf){
      if(tempPointBuf[pointIndex] == null)
        continue;
      let posX = tempPointBuf[pointIndex].posX;
      let posY = tempPointBuf[pointIndex].posY;
      let r = tempPointBuf[pointIndex].r;
      let g = tempPointBuf[pointIndex].g;
      let b = tempPointBuf[pointIndex].b;
      setRectangle(
          gl, posX, posY, 2/scale[0], 2/scale[1]);
      gl.uniform4f(colorLocation, r, g, b, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
  ctx2d.clearRect(0, 0, textCanvas.width, textCanvas.height);
  for(let cbIndex in drawCallbakcList){
    drawCallbakcList[cbIndex]();
  }
}

var addPoints = (posX, posY, r,g,b) => {
  pointBuf.push({posX, posY, r,g,b,});
};

var drawRectangle = (left, top, width, height, r, g, b)=>{
  setRectangle(
      gl, left, top, width/scale[0], height/scale[1]);
  gl.uniform4f(colorLocation, r, g, b, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

var clearPoints = ()=>{
  pointBuf = [];
};

var setScale = (mscale)=>{
  scale = mscale;
  drawScene();
};

var setCenter = (centerX, centerY)=>{
  var centerPosX = (leftPos + centerX) * scale[0];
  var centerPosY = (topPos + centerY) * scale[1];
  translation[0] += centerPosX;
  translation[1] += centerPosY;
  var canvas = document.getElementById("canvas");
  leftPos -= centerPosX;
  topPos -= centerPosY;
  drawScene();
};

var disableEvent = ()=>{
  eventFlag = false;
};

var enableEvent = ()=>{
  eventFlag = true;
};

var getCursorPos = ()=>{
  return {
    'x': (leftPos + getMouseX())/scale[0],
    'y': (topPos + getMouseY())/scale[1],
  }
};

var getScale = ()=>{
  return scale;
};

var createDrawObj = ()=>{
  let pointData = {'id': drawObjsId, 'points': []};
  drawObjsId ++;
  drawObjs.push(pointData);
  let drawObj = {
    'clear': ()=>{
      pointData['points'] = [];
    },
    'remove': ()=>{
      for(let drawIndex in drawObjs){
        if(drawObjs[drawIndex]['id'] == pointData['id'])
          drawObjs[drawIndex] = null;
      }
    },
    'addPoints': (posX, posY, r, g, b)=>{
      pointData['points'].push({posX, posY, r, g, b});
    },
    'setPoints': (points)=>{
      pointData['points'] = points;
    },
    'getPoints': ()=>{
      return pointData['points'];
    },
  }
  return drawObj;
}

var clearRect = (left, top, right, bottom) =>{
  for(let drawIndex in drawObjs){
    let tempPointBuf = drawObjs[drawIndex]['points'];
    for(let pointIndex in tempPointBuf){
      if(tempPointBuf[pointIndex] == null)
        continue;
      let posX = tempPointBuf[pointIndex].posX;
      let posY = tempPointBuf[pointIndex].posY;
      if(posX >= left && posX <= right && posY <= bottom && posY >= top){
        tempPointBuf[pointIndex] = null;
      }
    }
  }
};

var distance = (x1, y1, x2, y2) => {
  return Math.sqrt((x1 - x2) * (x1 -x2) + (y1 - y2) * (y1 - y2));
};

var drawText = (text, posX, posY) => {
  // 转换成canvas坐标
  let canvasX = posX * scale[0] + translation[0];
  let canvasY = posY * scale[1] + translation[1];
  ctx2d.fillText(text, canvasX, canvasY);
};

var drawCallbakcList = [];
var onDraw = (cb) => {
  drawCallbakcList.push(cb);
};



initCanvas();

module.exports = {
  'addPoints': addPoints,
  'drawScene': drawScene,
  'clearPoints': clearPoints,
  'setScale': setScale,
  'getScale': getScale,
  'setCenter': setCenter,
  'disableEvent': disableEvent,
  'enableEvent': enableEvent,
  'getCursorPos': getCursorPos,
  'createDrawObj': createDrawObj,
  'clearRect': clearRect,
  'distance': distance,
  'drawRectangle': drawRectangle,
  'drawText': drawText,
  'onDraw': onDraw,
}
