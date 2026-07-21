const { exec } = require('child_process');
backupMongoDB();
function backupMongoDB() {
  const child = exec(`mongodump --forceTableScan --uri "mongodb+srv://prashanth:BnHRQrqZHdnosfEe@cluster0.cpydc.mongodb.net/CommonDatabase?retryWrites=true&w=majority" --out "db"`)
  child.stdout.on('data', (data) => {
    console.log('stdout:\n', data)
  })

  child.stderr.on('data', (data) => {
    console.log('stderr:\n', Buffer.from(data).toString())
  })

  child.on('error', (error) => {
    console.log('errorL\n', error)
  })
  child.on('exit', (code, signal) => {
    if (code) console.log('Process exit with code:', code)
    else if (signal) console.log('Process killed with signal:', signal)
    else console.log('Backup is successfull')
  })
}