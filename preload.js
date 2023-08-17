window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})


const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('paTcpApiGet', {
  getPaData: (callback) => ipcRenderer.on('get_pa_data', callback)
})


contextBridge.exposeInMainWorld('paTcpApiSend', {
  sendPaData: (data) => ipcRenderer.send('send_pa_data', data)
})

contextBridge.exposeInMainWorld('paTcpApiSendCtrl', {
  sendPaCtrl: (data) => ipcRenderer.send('send_pa_ctrl', data)
})