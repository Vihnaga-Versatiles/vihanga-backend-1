//NakheelDatabase - to get restored data.
//OLLAADatabase - existing database dump.
//const { exec } = require('child_process');
//transferDB();
//function transferDB() {
//  const child = exec(`mongorestore --uri="mongodb+srv://prashanth:BnHRQrqZHdnosfEe@cluster0.cpydc.mongodb.net/NakheelDatabase?retryWrites=true&w=majority" --db NakheelDatabase "db/OLLAADatabase"`)
//  child.stdout.on('data', (data) => {
//    console.log('stdout:\n', data)
//  })

//  child.stderr.on('data', (data) => {
//    console.log('stderr:\n', Buffer.from(data).toString())
//  })

//  child.on('error', (error) => {
//    console.log('errorL\n', error)
//  })
//  child.on('exit', (code, signal) => {
//    if (code) console.log('Process exit with code:', code)
//    else if (signal) console.log('Process killed with signal:', signal)
//    else console.log('Restore is successfull')
//  })
//}