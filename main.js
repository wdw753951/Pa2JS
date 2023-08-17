const { app, BrowserWindow ,ipcMain } = require('electron')
const path = require('path')
var net = require('net');
var client = new net.Socket();
var client_ctrl = new net.Socket();
// const win

var MAX_PACK_SIZE=65536 //最大包数量
var HEAD_LENGTH=40; //包头长度

//C++ 结构体包头
// struct tcp_packet_head
// {
//   int32_t bodySize; //包尺寸
//   int32_t cmd;//命令
//   unsigned char reserve[32];//预留
// };

var MAX_PACK_DATA_SIZE=MAX_PACK_SIZE-HEAD_LENGTH //最大数据数

var raw_data_buffer =new Uint8Array(MAX_PACK_SIZE*10);
var raw_data_buffer_count=0;

var sscan_data_buffer =new Uint8Array(MAX_PACK_SIZE*10);
var sscan_data_buffer_count=0;
// var raw_data_length_buffer;

//命令类型
const RecvType = {
  SScanImage: 0,//06000000
  RawData: 1,//05000000
  RawDataLength: 3, //07000000
  GetConfig: 4,
  UDP:6
}

//因为JS 的tcp socket 最大buffer只有65536个字节，所以需要用包封装
function unpacket(data,win){
  // console.log(data.length);
  //获取包长度
  let pack_length=data[0];
  pack_length+=data[1]<<8;
  pack_length+=data[2]<<16;
  pack_length+=data[3]<<24;
  // console.log(pack_length);

  //获取命令
  let cmd=data[4];
  cmd+=data[5]<<8;
  cmd+=data[6]<<16;
  cmd+=data[7]<<24;

  //结束标志
  let endFlag=data[8];
  endFlag+=data[9]<<8;
  endFlag+=data[10]<<16;
  endFlag+=data[11]<<24;
 //数据总大小
  let totalLength=data[12];
  totalLength+=data[13]<<8;
  totalLength+=data[14]<<16;
  totalLength+=data[15]<<24;
  // console.log(totalLength);


  let write_date;
  //判断包头数据是否完整
  if(cmd<0 ||totalLength<0|| pack_length<0 ){
    return;
  }

  if(endFlag!=1 && endFlag!=0){
    return;
  }

  //判断包数据是否完整
// console.log(pack_length+HEAD_LENGTH);
//   console.log(data.size);
  if(data.length!=pack_length+HEAD_LENGTH){
    return;
  }



  if(cmd==RecvType.SScanImage){
    if(sscan_data_buffer_count==0){ //重新拼接包头
      let temp=data.slice(0,HEAD_LENGTH);
      sscan_data_buffer.set(temp);
      sscan_data_buffer_count+=temp.length
    }

    // console.log(sscan_data_buffer.length);

    if(sscan_data_buffer_count+data.length-2*HEAD_LENGTH<totalLength){
      if(endFlag==1){
        sscan_data_buffer_count=0;
        return;
      }

      sscan_data_buffer.set(data.slice(HEAD_LENGTH),sscan_data_buffer_count);
      sscan_data_buffer_count+=data.length-HEAD_LENGTH;
      return;
    }else{
      sscan_data_buffer.set(data.slice(HEAD_LENGTH),sscan_data_buffer_count);
      // write_date=sscan_data_buffer.slice(0,totalLength);
      // sscan_data_buffer_count=0

      if(endFlag==1){
        write_date=sscan_data_buffer.slice(0,totalLength+HEAD_LENGTH);
        sscan_data_buffer_count=0;
      }else{
        sscan_data_buffer_count+=data.slice(HEAD_LENGTH).length;
        return;
      }
    }

  }else if(cmd==RecvType.RawData){

    if(raw_data_buffer_count==0){ //重新拼接包头
      let temp=data.slice(0,HEAD_LENGTH);
      raw_data_buffer.set(temp);
      raw_data_buffer_count+=temp.length
    }

    if(raw_data_buffer_count+data.length-2*HEAD_LENGTH<totalLength){  //数据少于包头数据则继续收
      // console.log("actur:");
      // console.log(raw_data_buffer_count+data.length-2*HEAD_LENGTH);
      if(endFlag==1){
        raw_data_buffer_count=0;
        return;
      }
      raw_data_buffer.set(data.slice(HEAD_LENGTH),raw_data_buffer_count);
      raw_data_buffer_count+=data.length-HEAD_LENGTH;
      return;
    }else{
      raw_data_buffer.set(data.slice(HEAD_LENGTH),raw_data_buffer_count);
      // write_date=raw_data_buffer.slice(0,totalLength);
      // raw_data_buffer_count=0;
      if(endFlag==1){
        write_date=raw_data_buffer.slice(0,totalLength+HEAD_LENGTH);
        raw_data_buffer_count=0;
      }else{
        raw_data_buffer_count+=data.slice(HEAD_LENGTH).length;
        return;
      }
    }



  }else if(cmd==RecvType.GetConfig){


  }
  else if(cmd==RecvType.RawDataLength){
    write_date=data;
  }
  // console.log(write_date);
  win.webContents.send('get_pa_data', write_date)

}


function createWindow () {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  var HOST = '127.0.0.1'; //server ip
  var PORT = 45680; //tcp port
  var PORT_CTRL=45681 //tcp ctrl_port
  // var PORT = 8888; //tcp port


  client.connect(PORT, HOST, function() {

    console.log('CONNECTED TO: ' + HOST + ':' + PORT);

  });
  client_ctrl.connect(PORT_CTRL, HOST, function() {

    console.log('CONNECTED TO: ' + HOST + ':' + PORT_CTRL);

  });


// data是服务器发回的数据
  client.on('data', function(data) {

    // console.log('DATA: ' + data);
    unpacket(data,win)
    // console.log(data);

    // win.webContents.send('get_pa_data', data)
    // 完全关闭连接
    // client.destroy();
  });
  // data是服务器发回的数据
  client_ctrl.on('data', function(data) {

    // console.log('DATA: ' + data);
    unpacket(data,win)
    // console.log(data);

    // win.webContents.send('get_pa_data', data)
    // 完全关闭连接
    // client.destroy();
  });

  client_ctrl.on('close', function() {
    console.log('Connection closed');
  });

// 为客户端添加“close”事件处理函数
  client.on('close', function() {
    console.log('Connection closed');
  });

  win.loadFile('index.html')
}


function handleSendPaData (event, data) {
  // console.log(data);
  client.write(data);
}
function handleSendPaCtrl (event, data) {
  // console.log(data);
  client_ctrl.write(data);
}


app.whenReady().then(() => {
  ipcMain.on('send_pa_data', handleSendPaData)
  ipcMain.on('send_pa_ctrl', handleSendPaCtrl)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

