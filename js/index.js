var Menu = require('electron').remote.Menu;
var ipcRenderer = require('electron').ipcRenderer;
var $ = require('./jquery.js');
var mapPointsUtil = require('../utils/mappoints.js');
var remote = require('electron').remote;
var pointCloud = require('./point-cloud.js')
function loadUrl(url) {
    return function () {
        webview.src = url;
    }
}
var template = [
    {
        label: '文件',
        submenu: [
            {
                label: '导入地图文件',
                click:()=>{
                  ipcRenderer.send("import-map-file");
                },
            },
            {
                label: '导入路径文件',
                click:()=>{
                  ipcRenderer.send("import-keyframes");
                },
            },
            {
                label: '导入导航路径文件',
                click:()=>{
                  ipcRenderer.send("import-nav-path");
                },
            },
            {
                label: '导入导航点',
                click: () => {
                  ipcRenderer.send('import-nav-point');
                },
            },
            {
                type: 'separator'
            },
            {
                label: '另存为',
                click:()=>{
                  let resPoints = [];
                  for(let objIndex in drawObjs){
                    resPoints.push(drawObjs[objIndex].getPoints());
                  }
                  ipcRenderer.send("save-as", resPoints);
                },
            },
            {
              label: '保存导航点',
              click:()=>{
                ipcRenderer.send("save-nav-points", navPoints.getPoints());
              },
            },
            {
                type: 'separator'
            },
            {
                label: '退出',
                click:()=>{
                  ipcRenderer.send("exit");
                },
            },
        ]
    },
    {
        label: '帮助',
        submenu:[
            {
                label: '检查更新',
                click:()=>{
                  ipcRenderer.send("check-update");
                },
            },
            {
                label: '关于',
                click:()=>{
                  ipcRenderer.send("about");
                },
            }
        ]
    }
];
var menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
ipcRenderer.on("change-status", (sender, status)=>{
  console.log(status);
  document.querySelectorAll(".status-bar")[0].innerHTML = status;
});

let camera = {};
let scale = 1;
let mappoints = null;
let keyframes = null;

// map range params
let minZ = 0;
let maxZ = 0;
let minX = 0;
let maxX = 0;
let minY = 0;
let maxY = 0;



let drawMapPointFlag = true;
let renderFlag = false;

function renderCanvas(mcamera = camera, mscale = scale, mmappoints = mappoints, mkeyframes = keyframes){
  if(renderFlag)
    return;
  console.log("开始绘图");
  pointCloud.disableEvent();
  renderFlag = true;
  if(mappoints == null && mmappoints != null){
    mscale = canvasWidth/(maxX - minX);
    pointCloud.setScale([mscale, mscale]);
    pointCloud.setCenter((maxX - minX)/2, (maxZ - minZ)/2);
  }else if(mappoints == null && mmappoints == null){
    console.log("结束绘图");
    renderFlag = false;
    return;
  }

  camera = mcamera;
  scale = mscale;
  mappoints = mmappoints;
  keyframes = mkeyframes;

  document.querySelectorAll(".status-bar")[0].innerHTML = `开始绘图`;


  if(drawMapPointFlag){
    // start render
    let drawCount = 0;
    for(let pointIndex in mmappoints){
      let currentPointPos = mapPointsUtil.getPosition(mmappoints[pointIndex]['mWorldPos']);
      let mX = currentPointPos.x;
      let mZ = currentPointPos.z;
      pointCloud.addPoints(mX, mZ, 0,0.5,0);
      drawCount ++;
    }
    document.querySelectorAll(".status-bar")[0].innerHTML = `绘制 ${drawCount} 个点`;
  }

  // 绘制keyframes
  let frameDrawCount = 0;
  for(let frameIndex in mkeyframes){
    let currentPointPos = mapPointsUtil.getPosition(mkeyframes[frameIndex]['Ow']);
    let mX = currentPointPos.x;
    let mZ = currentPointPos.z;
    // calc point position in canvas
    pointCloud.addPoints(mX, mZ, 0,0,1);
    frameDrawCount ++;
  }
  document.querySelectorAll(".status-bar")[0].innerHTML = `绘制 ${frameDrawCount} 个路径点`;
  pointCloud.enableEvent();
  renderFlag = false;
  pointCloud.drawScene();
  console.log("绘图完毕");
}


ipcRenderer.on('render-result', (sender, data)=>{
  let mapPoints = remote.getGlobal('sharedObject')["mapPoints"];
  let keyFrames = remote.getGlobal('sharedObject')["keyFrames"];
  renderCanvas(camera, scale, mapPoints, keyFrames);
});

ipcRenderer.on('set-nav-path', (sender, data) => {
  let navPoints = pointCloud.createDrawObj();
  navPoints.setPoints(data);
  drawObjs.push(navPoints);
  pointCloud.drawScene();
});

ipcRenderer.on('map-range', (sender, data)=>{
  minZ = data.minZ;
  maxZ = data.maxZ;
  minX = data.minX;
  maxX = data.maxX;
  minY = data.minY;
  maxY = data.maxY;
});

ipcRenderer.on('set-nav-point', (sender, data) => {
  // 检查对应的路径点是不是已经载入
  let trackLoaded = false;
  for(let objIndex in drawObjs){
    let pointsList = drawObjs[objIndex].getPoints();
    for(let pointIndex in pointsList){
      let point = pointsList[pointIndex];
      if(point.posX == data[0].posX && point.posY == data[0].posY)
        trackLoaded = true;
    }
  }

  if(trackLoaded == false){
    $('.status-bar').text("请先载入对应的track文件");
    return;
  }

  if(navPoints == null){
    navPoints = pointCloud.createDrawObj();
    pointCloud.onDraw(()=>{
      // 绘制文字
      let navPointsList = navPoints.getPoints();
      for(let pointIndex in navPointsList){
        pointCloud.drawText(pointIndex, navPointsList[pointIndex]['posX'],
          navPointsList[pointIndex]['posY']);
      }
    });
  }
  navPoints.setPoints(data);
  pointCloud.drawScene();
});

$('.canvas-result')[0].width = $('.canvas-result').width();
$('.canvas-result')[0].height = $('.canvas-result').height();
canvasWidth = $('.canvas-result').width();
canvasHeight = $('.canvas-result').height();

$(window).on('resize', (evt) => {
  canvasWidth = $('.canvas-result').width();
  canvasHeight = $('.canvas-result').height();
});


// draw tool
var pencil = $('.tool-pencil');
var moveTool = $('.tool-move');
var eraserTool = $('.tool-eraser');
var selectTool = $('.tool-select');
var smoothTool = $('.tool-smooth');
var navTool = $('.tool-nav-points');
var dragFlag = false;

pencil.on('click', (evt) => {
  evt.preventDefault();
  pointCloud.enableEvent();
  let pencilFlag = false;
  if(!pencil.hasClass('active')){
    pencilFlag = true;
  }
  $('.draw-tool-list a').removeClass('active');
  if(pencilFlag)
    pencil.addClass('active');
  tempDrawPoints.clear();
  pointCloud.drawScene();
});

moveTool.on('click', (evt) => {
  evt.preventDefault();
  pointCloud.enableEvent();
  let moveFlag = false;
  if(!moveTool.hasClass('active')){
    moveFlag = true;
  }
  $('.draw-tool-list a').removeClass('active');
  if(moveFlag)
    moveTool.addClass('active');
  tempDrawPoints.clear();
  pointCloud.drawScene();
});

eraserTool.on('click', (evt) => {
  evt.preventDefault();
  let eraserFlag = false;
  if(!eraserTool.hasClass('active')){
    eraserFlag = true;
  }
  $('.draw-tool-list a').removeClass('active');
  if(eraserFlag){
    eraserTool.addClass('active');
    pointCloud.disableEvent();
  }
  tempDrawPoints.clear();
  pointCloud.drawScene();
});

selectTool.on('click', (evt) => {
  evt.preventDefault();
  pointCloud.enableEvent();
  let selectFlag = false;
  if(!selectTool.hasClass('active')){
    selectFlag = true;
  }
  $('.draw-tool-list a').removeClass('active');
  if(selectFlag){
    selectTool.addClass('active');
  }
  tempDrawPoints.clear();
  pointCloud.drawScene();
});

smoothTool.on('click', (evt)=>{
  evt.preventDefault();
  pointCloud.enableEvent();
  let smoothFlag = false;
  if(!smoothTool.hasClass('active')){
    smoothFlag = true;
  }
  $('.draw-tool-list a').removeClass('active');
  if(smoothFlag){
    smoothTool.addClass('active');
  }
  tempDrawPoints.clear();
  pointCloud.drawScene();
});

navTool.on('click', (evt) => {
  evt.preventDefault();
  pointCloud.enableEvent();
  let navFlag = false;
  if(!navTool.hasClass('active')){
    navFlag = true;
  }
  $('.draw-tool-list a').removeClass('active');
  if(navFlag){
    navTool.addClass('active');
  }
  tempDrawPoints.clear();
  pointCloud.drawScene();
});



var toolPointBuf = [];
var drawObjs = [];
var navPoints = null;
$('.canvas-result').on('click', (evt)=>{
  evt.preventDefault();
  var cursorPos = pointCloud.getCursorPos();
  if(pencil.hasClass('active') && toolPointBuf.length == 0){
    toolPointBuf.push({'posX': cursorPos.x, 'posY': cursorPos.y});
    tempDrawPoints.addPoints(cursorPos.x, cursorPos.y, 1, 0, 0);
    pointCloud.drawScene();
    return
  }

  if(pencil.hasClass('active') && toolPointBuf.length == 1){
    let newLine = pointCloud.createDrawObj();
    drawObjs.push(newLine);
    newLine.setPoints(tempDrawPoints.getPoints());
    tempDrawPoints.clear();
    toolPointBuf = [];
    return;
  }

  if(selectTool.hasClass('active') && toolPointBuf.length == 0){
    toolPointBuf.push({'posX': cursorPos.x, 'posY': cursorPos.y});
    tempDrawPoints.addPoints(cursorPos.x, cursorPos.y, 1, 0, 0);
    pointCloud.drawScene();
    return
  }

  if(selectTool.hasClass('active') && toolPointBuf.length == 1){
    // delete selection
    let cursorPos = pointCloud.getCursorPos();
    let left = Math.min(cursorPos.x, toolPointBuf[0].posX);
    let top = Math.min(cursorPos.y, toolPointBuf[0].posY);
    let right = Math.max(cursorPos.x, toolPointBuf[0].posX);
    let bottom = Math.max(cursorPos.y, toolPointBuf[0].posY);
    pointCloud.clearRect(left, top, right, bottom);
    tempDrawPoints.clear();
    toolPointBuf = [];
    pointCloud.drawScene();
    return;
  }

  if(smoothTool.hasClass('active') && toolPointBuf.length < 2){
    toolPointBuf.push({'posX': cursorPos.x, 'posY': cursorPos.y});
    tempDrawPoints.addPoints(cursorPos.x, cursorPos.y, 1, 0, 0);
    pointCloud.drawScene();
    return
  }

  if(smoothTool.hasClass('active') && toolPointBuf.length == 2){
    // 画出二阶贝塞尔曲线
    let cursorPos = pointCloud.getCursorPos();
    var bezier = (t)=>{
      return {
        'x': (1 - t) * (1 - t) * toolPointBuf[0].posX
          + 2 * t * (1 -t) * toolPointBuf[1].posX + t * t * cursorPos.x,
        'y': (1 - t) * (1 - t) * toolPointBuf[0].posY
          + 2 * t * (1 -t) * toolPointBuf[1].posY + t * t * cursorPos.y,
      }
    }
    // 计算点的个数
    let distance = pointCloud.distance(toolPointBuf[0].posX, toolPointBuf[0].posY,
    toolPointBuf[1].posX, toolPointBuf[1].posY) + pointCloud.distance(toolPointBuf[1].posX, toolPointBuf[1].posY,
    cursorPos.x, cursorPos.y);
    scale = pointCloud.getScale()[0];
    let distanceInPixel = distance * scale;
    for(let i=0;i<distanceInPixel;i++){
      let bezierPoint = bezier(i / distanceInPixel);
      tempDrawPoints.addPoints(bezierPoint.x, bezierPoint.y, 1, 0, 0);
    }
    // 创建draw对象
    let bezierDraw = pointCloud.createDrawObj();
    drawObjs.push(bezierDraw);
    // 去掉中间点
    pointCloud.clearRect(toolPointBuf[1].posX, toolPointBuf[1].posY, toolPointBuf[1].posX, toolPointBuf[1].posY);
    bezierDraw.setPoints(tempDrawPoints.getPoints());
    toolPointBuf = [];
    tempDrawPoints.clear();
    pointCloud.drawScene();
    return;
  }

  if(navTool.hasClass('active')){
    let cursorPos = pointCloud.getCursorPos();
    // 添加导航点
    // 找到最近的路径点，设置为导航点
    let minDistance = 0;
    let minPoint = null;
    for(let objIndex in drawObjs){
      let drawPointsList = drawObjs[objIndex].getPoints();
      for(let pointIndex in drawPointsList){
        if (drawPointsList[pointIndex] == null)
          continue;
        let posX = drawPointsList[pointIndex]['posX'];
        let posY = drawPointsList[pointIndex]['posY'];
        let mdistance = pointCloud.distance(cursorPos.x, cursorPos.y, posX, posY);
        if(minDistance == 0 || mdistance < minDistance){
          minDistance = mdistance;
          minPoint = drawPointsList[pointIndex];
        }
      }
    }
    if(navPoints == null){
      navPoints = pointCloud.createDrawObj();
      pointCloud.onDraw(()=>{
        // 绘制文字
        let navPointsList = navPoints.getPoints();
        for(let pointIndex in navPointsList){
          pointCloud.drawText(pointIndex, navPointsList[pointIndex]['posX'],
            navPointsList[pointIndex]['posY']);
        }
      });
    }

    navPoints.addPoints(minPoint['posX'], minPoint['posY'], 0.53, 0, 0);
    pointCloud.drawScene();
  }

});

// 右键点击事件
$('.canvas-result').on('contextmenu', (evt)=>{
  tempDrawPoints.clear();
  toolPointBuf = [];
  if(navPoints != null){
    // 删除最后的一个点
    let navPointsList = navPoints.getPoints();
    navPointsList.pop();
  }
  pointCloud.drawScene();
});

$('.canvas-result').on('mousedown', (evt) => {
  dragFlag = true;
});

$('.canvas-result').on('mouseup', (evt) => {
  dragFlag = false;
});


var tempDrawPoints = pointCloud.createDrawObj();
$('.canvas-result').on('mousemove', (evt)=>{
  var cursorPos = pointCloud.getCursorPos();
  if(pencil.hasClass('active') && toolPointBuf.length == 1){
    tempDrawPoints.clear();
    var previousPoint = toolPointBuf[0];
    // point count
    let deltaX = Math.abs(cursorPos.x - previousPoint.posX);
    let deltaY = Math.abs(cursorPos.y - previousPoint.posY);
    let pointCount = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    let xdiff = deltaX/pointCount;

    // 画线
    scale =  pointCloud.getScale()[0]
    let k = (cursorPos.y - previousPoint.posY) / (cursorPos.x - previousPoint.posX);
    let b = cursorPos.y - k * cursorPos.x;
    for(let i=0;i< Math.abs(cursorPos.x - previousPoint.posX) * scale; i += xdiff){
      if(cursorPos.x - previousPoint.posX > 0)
        tempDrawPoints.addPoints(previousPoint.posX + i/scale,
           b + k * (previousPoint.posX + i/scale), 1,0,0);
      else
        tempDrawPoints.addPoints(previousPoint.posX - i/scale,
           b + k * (previousPoint.posX - i/scale), 1,0,0);
    }
    pointCloud.drawScene();
  }

  if(eraserTool.hasClass('active')){
    // draw eraser
    tempDrawPoints.clear();
    scale = pointCloud.getScale()[0];
    if(dragFlag){
      // clear points in range
      pointCloud.clearRect(cursorPos.x - 10/scale, cursorPos.y - 10/scale, cursorPos.x + 10/scale, cursorPos.y + 10/scale);
    }
    pointCloud.drawScene();
    pointCloud.drawRectangle(cursorPos.x - 10 / scale, cursorPos.y - 10 / scale, 20, 20, 0, 0, 0);
    return;
  }

  if(selectTool.hasClass('active') && toolPointBuf.length == 1){
    tempDrawPoints.clear();
    scale = pointCloud.getScale()[0];
    var previousPoint = toolPointBuf[0];
    for(let i=0;i<Math.abs(cursorPos.x - previousPoint.posX) * scale;i++){
      if(cursorPos.x - previousPoint.posX > 0){
        tempDrawPoints.addPoints(previousPoint.posX + i/scale, previousPoint.posY, 0, 0, 0);
        tempDrawPoints.addPoints(previousPoint.posX + i/scale, cursorPos.y, 0, 0, 0);
      }else{
        tempDrawPoints.addPoints(previousPoint.posX - i/scale, previousPoint.posY, 0, 0, 0);
        tempDrawPoints.addPoints(previousPoint.posX - i/scale, cursorPos.y, 0, 0, 0);
      }
    }

    for(let i=0; i < Math.abs(cursorPos.y - previousPoint.posY) * scale; i++){
      if(cursorPos.y - previousPoint.posY > 0){
        tempDrawPoints.addPoints(previousPoint.posX, previousPoint.posY + i/scale, 0, 0, 0);
        tempDrawPoints.addPoints(cursorPos.x, previousPoint.posY + i/scale, 0, 0, 0);
      }else{
        tempDrawPoints.addPoints(previousPoint.posX, previousPoint.posY - i/scale, 0, 0, 0);
        tempDrawPoints.addPoints(cursorPos.x, previousPoint.posY - i/scale, 0, 0, 0);
      }
    }

    pointCloud.drawScene();
    return;
  }

});
