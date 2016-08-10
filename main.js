const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const MenuItem = electron.MenuItem;
const ipcMain = electron.ipcMain;
const dialog = electron.dialog;
const bson = require('bson');
const fs = require('fs');
const Q = require('q');
const mapPointsUtil = require("./utils/mappoints.js");




let mainWindow
global.sharedObject = {
  'mapPoints': null,
  'keyFrames': null,
};

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 960, height: 600, 'minHeight': 480, 'minWidth': 640})
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  //mainWindow.webContents.openDevTools()

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

app.on('ready', createWindow)


app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

// menu events
ipcMain.on('import-map-file', ()=>{
  let mapfile = dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {name: 'Bson', extensions: ['bson']},
    ]
  });

  if(typeof mapfile == 'undefined')
    return;
  setStatus("正在加载地图文件: " + mapfile[0]);
  Q.nfcall(fs.readFile, mapfile[0])
  .then((data)=>{
    setStatus("开始解析地图文件: " + mapfile[0]);
    var BSON = new bson.BSONPure.BSON();
    var mappoints = BSON.deserialize(data);
    if(typeof mappoints[0].mnVisible === 'undefined'){
      // 无效的文件
      console.log("invalid file");
      return;
    }
    setStatus("地图文件解析成功: " + mapfile[0]);
    // find top and bottom map points
    let minZ = 0;
    let maxZ = 0;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    let mapPointsCount = 0;

    for(let pointIndex in mappoints){
      let pos = mapPointsUtil.getPosition(mappoints[pointIndex]['mWorldPos']);
      if(minZ == 0 || -pos.y < minZ){
        minZ = -pos.y;
      }
      if(maxZ == 0 || -pos.y > maxZ){
        maxZ = -pos.y;
      }
      if(maxY == 0 || pos.z > maxZ){
        maxY = pos.z;
      }
      if(minY == 0 || pos.z < minY){
        minY = pos.z
      }
      if(maxX == 0 || pos.x > maxX){
        maxX = pos.x;
      }
      if(minX == 0 || pos.x < minX){
        minX = pos.x;
      }
      mapPointsCount ++;
    }
    setStatus("成功载入 " + mapPointsCount + " 个特征点");
    // render canvas
    // 计算高度范围
    maxHeight = parseInt(maxZ) + 1;
    minHeight = parseInt(minZ) - 1;
    setMapRange({minZ, maxZ, minX, maxX, minY, maxY});
    var rio = 2000 / mapPointsCount;
    let sampleMapPoints = [];
    for(let pointIndex in mappoints){
      if(Math.random() < rio){
        sampleMapPoints.push(mappoints[pointIndex]);
      }
    }
    renderCanvas(sampleMapPoints, null);
  });
})

ipcMain.on('import-keyframes', ()=>{
  let keyFrameFile = dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {name: 'Bson', extensions: ['bson']},
    ]
  });

  if(typeof keyFrameFile == 'undefined')
    return;
  setStatus("正在关键帧文件: " + keyFrameFile[0]);
  Q.nfcall(fs.readFile, keyFrameFile[0])
  .then((data)=>{
    setStatus("开始解析关键帧文件: " + keyFrameFile[0]);
    var BSON = new bson.BSONPure.BSON();
    var keyFrames = BSON.deserialize(data);
    if(typeof keyFrames[0]["Cw"] === 'undefined'){
      // 无效的文件
      console.log("invalid file");
      return;
    }
    setStatus("关键帧文件解析成功: " + keyFrameFile[0]);
    let frameCount = 0;
    for(let frameIndex in keyFrames){
      frameCount ++;
    }
    setStatus("成功载入 " + frameCount + " 个关键帧");
    // render canvas
    // 计算高度范围
    renderCanvas(null,keyFrames);
  });
})

ipcMain.on('save-as', (sender, data) => {
  var filename = dialog.showSaveDialog({'title': '文件另存为', 'filters': [
    {name: 'Csv', extensions: ['csv']},
  ]});
  let resStr = "";
  for(let objIndex in data){
    for(let pointIndex in data[objIndex]){
      if(data[objIndex][pointIndex] == null)
        continue;
      resStr += `${data[objIndex][pointIndex]['posX']} ${data[objIndex][pointIndex]['posY']} \n`;
    }
  }
  fs.writeFile(filename, resStr, (err) => {
    if(err){
      dialog.showErrorBox("错误", "保存文件时发生错误： " + err);
      return;
    }
    setStatus("文件保存成功");
  });
});

ipcMain.on('import-nav-path', ()=>{
  // open file
  let navPathFile = dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {name: 'Csv', extensions: ['csv']},
    ]
  });

  if(typeof navPathFile == 'undefined')
    return;
  setStatus("正在载入导航路径文件: " + navPathFile[0]);
  Q.nfcall(fs.readFile, navPathFile[0], 'utf8')
  .then((data)=>{
    setStatus("开始解析导航路径文件: " + navPathFile[0]);
    try {
      let navPoints = [];
      let pointData = data.split('\n');
      for(let pointIndex in pointData){
        let point = pointData[pointIndex].split(' ');
        if(point.length == 1)
          continue;
        navPoints.push({
          'posX': parseFloat(point[0]),
          'posY': parseFloat(point[1]),
          'r': 1,
          'g': 0,
          'b': 0,
        });
      }
      setStatus("导航路径文件载入成功: " + navPathFile[0]);
      mainWindow.webContents.send("set-nav-path", navPoints);
    } catch (e) {
      setStatus("导航路径文件载入失败: " + navPathFile[0] + e);
    }
  });
});

ipcMain.on('save-nav-points', (sender, data) => {
  var filename = dialog.showSaveDialog({'title': '文件另存为', 'filters': [
    {name: 'Csv', extensions: ['csv']},
  ]});
  let resStr = "";
  for(let objIndex in data){
      resStr += `${data[objIndex]['posX']} ${data[objIndex]['posY']} \n`;
  }
  fs.writeFile(filename, resStr, (err) => {
    if(err){
      dialog.showErrorBox("错误", "保存文件时发生错误： " + err);
      return;
    }
    setStatus("文件保存成功");
  });
});

ipcMain.on('import-nav-point', () => {
  let navPathFile = dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {name: 'Csv', extensions: ['csv']},
    ]
  });

  if(typeof navPathFile == 'undefined')
    return;
  setStatus("正在载入导航点文件: " + navPathFile[0]);
  Q.nfcall(fs.readFile, navPathFile[0], 'utf8')
  .then((data)=>{
    setStatus("开始解析导航点文件: " + navPathFile[0]);
    try {
      let navPoints = [];
      let pointData = data.split('\n');
      for(let pointIndex in pointData){
        let point = pointData[pointIndex].split(' ');
        if(point.length == 1)
          continue;
        navPoints.push({
          'posX': parseFloat(point[0]),
          'posY': parseFloat(point[1]),
          'r': 0.53,
          'g': 0,
          'b': 0,
        });
      }
      setStatus("导航点文件载入成功: " + navPathFile[0]);
      mainWindow.webContents.send("set-nav-point", navPoints);
    } catch (e) {
      setStatus("导航点文件载入失败: " + navPathFile[0] + e);
    }
  });
})

ipcMain.on('about', () => {
  dialog.showMessageBox({'type': 'info', 'title': "关于", 'message': "导航路径编辑器由蓝鲸智能精心制作\n V1.0.0", 'buttons': []});
});

function renderSlideBar(minHeight, maxHeight){
  if(mainWindow == null)
    return;
  mainWindow.webContents.send("slide-value", {
    'minHeight': minHeight,
    'maxHeight': maxHeight
  });
}

function renderCanvas(mappoints, keyFrames){
  // render map points
  if(mappoints != null)
    global.sharedObject["mapPoints"] = mappoints;
  if(keyFrames != null)
    global.sharedObject["keyFrames"] = keyFrames;
  mainWindow.webContents.send("render-result", {});
}

function setStatus(status){
  if(mainWindow == null)
    return;
  mainWindow.webContents.send("change-status", status);
}

function setMapRange(data){
  if(mainWindow == null)
    return;
  mainWindow.webContents.send("map-range", data);
}
