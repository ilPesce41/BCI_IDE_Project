const WebSocket = require('ws');
const vscode = require('vscode');
var fs = require('fs');
const { parse } = require('json2csv');
var date = new Date();
var date_str =date.toDateString().split(" ").join("");
var time_str = date.toLocaleTimeString().split(" ").join("");
time_str = time_str.split(":").join("_");
let desktop_str = require("os").homedir() + "/Desktop/";
const session_file = desktop_str+'/'+date_str+"_"+time_str+".csv";
var alpha_arr = [];
var beta_arr = [];
var theta_arr = [];

function get_webview_content() {
    return `
<html>
  <head>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load('current', {'packages':['corechart']});
      google.charts.setOnLoadCallback(function () {
        var chart = new google.visualization.BarChart(document.getElementById("container"));
        const options = {"title": "Foo!"};
        const columns = ["eng", "exc", "lex", "str", "rel", "int", "foc"]
        window.addEventListener("message", function (event) {
            const message = event.data;
            const sample_data = [message[1],message[3],message[4],message[6],message[8],message[10],message[12]]
            var data = google.visualization.arrayToDataTable([["source", "level"], ...columns.map((e, i) => [e, sample_data[i]])]);
            chart.draw(data, options);
        })})
    </script>
  </head>
  <body>
    <div id="container" style="width 100%; height 100%">
    </div>
  </body>
</html>
`
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
/**
 * This class handle:
 *  - create websocket connection
 *  - handle request for : headset , request access, control headset ...
 *  - handle 2 main flows : sub and train flow
 *  - use async/await and Promise for request need to be run on sync
 */
class Cortex {
    constructor (user, socketUrl) {
        // create socket
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
        this.socket = new WebSocket(socketUrl)

        // read user infor
        this.user = user
    }

    queryHeadsetId(){
        const QUERY_HEADSET_ID = 2
        let socket = this.socket
        let queryHeadsetRequest =  {
            "jsonrpc": "2.0", 
            "id": QUERY_HEADSET_ID,
            "method": "queryHeadsets",
            "params": {}
        }

        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(queryHeadsetRequest));
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==QUERY_HEADSET_ID){
                        // console.log(data)
                        // console.log(JSON.parse(data)['result'].length)
                        if(JSON.parse(data)['result'].length > 0){
                            let headsetId = JSON.parse(data)['result'][0]['id']
                            resolve(headsetId)
                        }
                        else{
                            console.log('No have any headset, please connect headset with your pc.')
                        }
                    }
                   
                } catch (error) {}
            })
        })
    }

    requestAccess(){
        let socket = this.socket
        let user = this.user
        return new Promise(function(resolve, reject){
            const REQUEST_ACCESS_ID = 1
            let requestAccessRequest = {
                "jsonrpc": "2.0", 
                "method": "requestAccess", 
                "params": { 
                    "clientId": user.clientId, 
                    "clientSecret": user.clientSecret
                },
                "id": REQUEST_ACCESS_ID
            }

            // console.log('start send request: ',requestAccessRequest)
            socket.send(JSON.stringify(requestAccessRequest));

            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==REQUEST_ACCESS_ID){
                        resolve(data)
                    }
                } catch (error) {}
            })
        })
    }

    authorize(){
        let socket = this.socket
        let user = this.user
        return new Promise(function(resolve, reject){
            const AUTHORIZE_ID = 4
            let authorizeRequest = { 
                "jsonrpc": "2.0", "method": "authorize", 
                "params": { 
                    "clientId": user.clientId, 
                    "clientSecret": user.clientSecret, 
                    "license": user.license, 
                    "debit": user.debit
                },
                "id": AUTHORIZE_ID
            }
            socket.send(JSON.stringify(authorizeRequest))
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==AUTHORIZE_ID){
                        let cortexToken = JSON.parse(data)['result']['cortexToken']
                        resolve(cortexToken)
                    }
                } catch (error) {}
            })
        })
    }

    controlDevice(headsetId){
        let socket = this.socket
        const CONTROL_DEVICE_ID = 3
        let controlDeviceRequest = {
            "jsonrpc": "2.0",
            "id": CONTROL_DEVICE_ID,
            "method": "controlDevice",
            "params": {
                "command": "connect",
                "headset": headsetId
            }
        }
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(controlDeviceRequest));
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==CONTROL_DEVICE_ID){
                        resolve(data)
                    }
                } catch (error) {}
            })
        }) 
    }

    createSession(authToken, headsetId){
        let socket = this.socket
        const CREATE_SESSION_ID = 5
        let createSessionRequest = { 
            "jsonrpc": "2.0",
            "id": CREATE_SESSION_ID,
            "method": "createSession",
            "params": {
                "cortexToken": authToken,
                "headset": headsetId,
                "status": "active"
            }
        }
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(createSessionRequest));
            socket.on('message', (data)=>{
                // console.log(data)
                try {
                    if(JSON.parse(data)['id']==CREATE_SESSION_ID){
                        let sessionId = JSON.parse(data)['result']['id']
                        resolve(sessionId)
                    }
                } catch (error) {}
            })
        })
    }

    startRecord(authToken, sessionId, recordName){
        let socket = this.socket
        const CREATE_RECORD_REQUEST_ID = 11

        let createRecordRequest = {
            "jsonrpc": "2.0", 
            "method": "updateSession", 
            "params": {
                "cortexToken": authToken,
                "session": sessionId,
                "status": "startRecord",
                "title": recordName,
                "description":"test_marker",
                "groupName": "QA"
            }, 
            "id": CREATE_RECORD_REQUEST_ID
        }

        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(createRecordRequest));
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==CREATE_RECORD_REQUEST_ID){
                        console.log('CREATE RECORD RESULT --------------------------------')
                        console.log(data)
                        resolve(data)
                    }
                } catch (error) {}
            })
        })
    }

    injectMarkerRequest(authToken, sessionId, label, value, port, time){
        let socket = this.socket
        const INJECT_MARKER_REQUEST_ID = 13
        let injectMarkerRequest = {
            "jsonrpc": "2.0",
            "id": INJECT_MARKER_REQUEST_ID,
            "method": "injectMarker", 
            "params": {
                "cortexToken": authToken, 
                "session": sessionId, 
                "label": label,
                "value": value, 
                "port": port,
                "time": time
            }
        }

        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(injectMarkerRequest));
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==INJECT_MARKER_REQUEST_ID){
                        console.log('INJECT MARKER RESULT --------------------------------')
                        console.log(data)
                        resolve(data)
                    }
                } catch (error) {}
            })
        })
    }

    stopRecord(authToken, sessionId, recordName){
        let socket = this.socket
        const STOP_RECORD_REQUEST_ID = 12
        let stopRecordRequest = {
            "jsonrpc": "2.0", 
            "method": "updateSession", 
            "params": {
                "cortexToken": authToken,
                "session": sessionId,
                "status": "stopRecord",
                "title": recordName,
                "description":"test_marker",
                "groupName": "QA"
            }, 
            "id": STOP_RECORD_REQUEST_ID
        }

        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(stopRecordRequest));
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==STOP_RECORD_REQUEST_ID){
                        console.log('STOP RECORD RESULT --------------------------------')
                        console.log(data)
                        resolve(data)
                    }
                } catch (error) {}
            })
        })
    }

    addMarker(){
        this.socket.on('open',async ()=>{
            await this.checkGrantAccessAndQuerySessionInfo()

            let recordName = 'test_marker'
            await this.startRecord(this.authToken, this.sessionId, recordName)

        
            let thisInjectMarker = this
            let numberOfMarker = 10
            for (let numMarker=0; numMarker<numberOfMarker; numMarker++){
                setTimeout(async function(){
                    // injectMarkerRequest(authToken, sessionId, label, value, port, time)
                    let markerLabel = "marker_number_" + numTrain
                    let markerTime = Date.now()
                    let marker = {
                        label:markerLabel,
                        value:"test",
                        port:"test",
                        time:markerTime
                    }

                    await thisInjectMarker.injectMarkerRequest( thisInjectMarker.authToken, 
                                                                thisInjectMarker.sessionId,
                                                                marker.label,
                                                                marker.value,
                                                                marker.port,
                                                                marker.time)
                }, 3000)
            }

            await thisStopRecord.stopRecord(thisStopRecord.authToken, thisStopRecord.sessionId, recordName)
        })
    }

    subRequest(stream, authToken, sessionId){
        let socket = this.socket
        const SUB_REQUEST_ID = 6 
        let subRequest = { 
            "jsonrpc": "2.0", 
            "method": "subscribe", 
            "params": { 
                "cortexToken": authToken,
                "session": sessionId,
                "streams": stream
            }, 
            "id": SUB_REQUEST_ID
        }
        console.log('sub eeg request: ', subRequest)
        socket.send(JSON.stringify(subRequest))
        socket.on('message', (data)=>{
            try {
                // if(JSON.parse(data)['id']==SUB_REQUEST_ID){
                    console.log('SUB REQUEST RESULT --------------------------------')
                    console.log(data)
                    console.log('\r\n')
                // }
            } catch (error) {}
        })
    }

    mentalCommandActiveActionRequest(authToken, sessionId, profile, action){
        let socket = this.socket
        const MENTAL_COMMAND_ACTIVE_ACTION_ID = 10
        let mentalCommandActiveActionRequest = {
            "jsonrpc": "2.0",
            "method": "mentalCommandActiveAction",
            "params": {
              "cortexToken": authToken,
              "status": "set",
              "session": sessionId,
              "profile": profile,
              "actions": action
            },
            "id": MENTAL_COMMAND_ACTIVE_ACTION_ID
        }
        // console.log(mentalCommandActiveActionRequest)
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(mentalCommandActiveActionRequest))
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==MENTAL_COMMAND_ACTIVE_ACTION_ID){
                        console.log('MENTAL COMMAND ACTIVE ACTION RESULT --------------------')
                        console.log(data)
                        console.log('\r\n')
                        resolve(data)
                    }
                } catch (error) {
                }
            })
        })
    }

    /**
     * - query headset infor
     * - connect to headset with control device request
     * - authentication and get back auth token
     * - create session and get back session id
     */
    async querySessionInfo(){
        let headsetId=""
        await this.queryHeadsetId().then((headset)=>{headsetId = headset})
        this.headsetId = headsetId

        let ctResult=""
        await this.controlDevice(headsetId).then((result)=>{ctResult=result})
        this.ctResult = ctResult
        console.log(ctResult)

        let authToken=""
        await this.authorize().then((auth)=>{authToken = auth})
        this.authToken = authToken

        let sessionId = ""
        await this.createSession(authToken, headsetId).then((result)=>{sessionId=result})
        this.sessionId = sessionId

        console.log('HEADSET ID -----------------------------------')
        console.log(this.headsetId)
        console.log('\r\n')
        console.log('CONNECT STATUS -------------------------------')
        console.log(this.ctResult)
        console.log('\r\n')
        console.log('AUTH TOKEN -----------------------------------')
        console.log(this.authToken)
        console.log('\r\n')
        console.log('SESSION ID -----------------------------------')
        console.log(this.sessionId)
        console.log('\r\n')
    }

    /**
     * - check if user logined
     * - check if app is granted for access
     * - query session info to prepare for sub and train
     */
    async checkGrantAccessAndQuerySessionInfo(){
        
        let requestAccessResult = await this.requestAccess()
        let accessGranted = JSON.parse(requestAccessResult)
    
        // check if user is logged in CortexUI
        if ("error" in accessGranted){
            console.log('You must login on CortexUI before request for grant access then rerun')
            throw new Error('You must login on CortexUI before request for grant access')
        }else{
            console.log(accessGranted['result']['message'])
            // console.log(accessGranted['result'])
            if(accessGranted['result']['accessGranted']){
                await this.querySessionInfo()
            }
            else{
                console.log('You must accept access request from this app on CortexUI then rerun')
                throw new Error('You must accept access request from this app on CortexUI')
            }
        }   
    }

    openWebview () {
        this.webviewPanel = vscode.window.createWebviewPanel(
            'bciChart',
            "BCI Chart",
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        )
        this.webviewPanel.webview.html = get_webview_content();
        this.webviewPanel.onDidDispose(e => {
            this.webviePanel = undefined;
        })
    }

    /**
     * 
     * - check login and grant access
     * - subcribe for stream
     * - logout data stream to console or file
     */
    sub(streams,isSilent){
        // this.openWebview();
	let status_bar = vscode.window.createStatusBarItem();
	let n = 0;
        this.socket.on('open',async ()=>{
            await this.checkGrantAccessAndQuerySessionInfo()
            this.subRequest(streams, this.authToken, this.sessionId)
            this.socket.on('message', (data)=>{
                // log stream data to file or console here
				//Wait for first pass
				if(n>0){
					let datam = JSON.parse(data)['pow']
                    //Send Performance data to the extension
                    // eng.isActive","eng","exc.isActive","exc","lex","str.isActive","str","rel.isActive","rel","int.isActive","int","foc.isActive","foc"
                    let AF3_theta = datam[0];
                    let AF3_alpha = datam[1];
                    let AF3_betaL = datam[2];
                    let AF3_betaH = datam[3];
                    let AF3_gamma = datam[4];
                    let AF4_theta = datam[20];
                    let AF4_alpha = datam[21];
                    let AF4_betaL = datam[22];
                    let AF4_betaH = datam[23];
                    let AF4_gamma = datam[24];

                    let log_data = {
                        "Time": new Date().getTime(),
                        "AF3/theta":AF3_theta,
                        "AF3/alpha":AF3_alpha,
                        "AF3/betaL":AF3_betaL,
                        "AF3/betaH":AF3_betaH,
                        "AF3/gamma":AF3_gamma,
                        "AF4/theta":AF4_theta,
                        "AF4/alpha":AF4_alpha,
                        "AF4/betaL":AF4_betaL,
                        "AF4/betaH":AF4_betaH,
                        "AF4/gamma":AF4_gamma
                    }
                    appendCSV(log_data,session_file)
                    let alpha = (AF3_alpha + AF4_alpha)/2;
                    let theta = (AF3_theta + AF4_theta)/2;
                    let beta = (AF3_betaH + AF4_betaH + AF3_betaL + AF4_betaL)/2;

                    alpha_arr.push(alpha);
                    beta_arr.push(beta);
                    theta_arr.push(theta);
                    console.log(alpha_arr)
                    if (alpha_arr.length>50){
                        alpha_arr = alpha_arr.splice(1,50)
                    }
                    if (beta_arr.length>50){
                        beta_arr = beta_arr.splice(1,50)
                    }
                    if (theta_arr.length>50){
                        theta_arr = theta_arr.splice(1,50)
                    }
                    const arrAvg = arr => arr.reduce((a,b) => a + b, 0) / arr.length
                    alpha = arrAvg(alpha_arr);
                    beta = arrAvg(beta_arr);
                    theta = arrAvg(theta_arr);
                    let engagement = beta/(alpha + theta);


                    if(!isSilent){
                        status_bar.text =`engagment ${engagement.toFixed(2)}, alpha ${alpha.toFixed(2)}, beta ${beta.toFixed(2)}, theta ${theta.toFixed(2)}`;// data["met"];
                        // if (this.webviewPanel) {
                        //     this.webviewPanel.webview.postMessage(datam)
                        // }
                        console.log(n);
                        console.log(datam);
                        status_bar.show();
                        
                        // Show warning messages when data is updates
                        checkForAlert(engagement);

                        // Apply Color theme when data is updates
                        ApplyColorTheme(engagement);
                    }
                    
				}
				n = n+1;
            })
        })
    }


    setupProfile(authToken, headsetId, profileName, status){
        const SETUP_PROFILE_ID = 7
        let setupProfileRequest = {
            "jsonrpc": "2.0",
            "method": "setupProfile",
            "params": {
              "cortexToken": authToken,
              "headset": headsetId,
              "profile": profileName,
              "status": status
            },
            "id": SETUP_PROFILE_ID
        }
        // console.log(setupProfileRequest)
        let socket = this.socket
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(setupProfileRequest));
            socket.on('message', (data)=>{
                if(status=='create'){
                    resolve(data)
                }

                try {
                    // console.log('inside setup profile', data)
                    if(JSON.parse(data)['id']==SETUP_PROFILE_ID){
                        if(JSON.parse(data)['result']['action']==status){
                            console.log('SETUP PROFILE -------------------------------------')
                            console.log(data)
                            console.log('\r\n')
                            resolve(data)
                        }
                    }
                    
                } catch (error) {
                    
                }

            })
        })
    }

    queryProfileRequest(authToken){
        const QUERY_PROFILE_ID = 9
        let queryProfileRequest = {
            "jsonrpc": "2.0",
            "method": "queryProfile",
            "params": {
              "cortexToken": authToken
            },
            "id": QUERY_PROFILE_ID
        }

        let socket = this.socket
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(queryProfileRequest))
            socket.on('message', (data)=>{
                try {
                    if(JSON.parse(data)['id']==QUERY_PROFILE_ID){
                        // console.log(data)
                        resolve(data)
                    }
                } catch (error) {
                    
                }
            })
        })
    }


    /**
     *  - handle send training request
     *  - handle resolve for two difference status : start and accept
     */
    trainRequest(authToken, sessionId, action, status){
        const TRAINING_ID = 8
        const SUB_REQUEST_ID = 6
        let trainingRequest = {
            "jsonrpc": "2.0", 
            "method": "training", 
            "params": {
              "cortexToken": authToken,
              "detection": "mentalCommand",
              "session": sessionId,
              "action": action,
              "status": status
            }, 
            "id": TRAINING_ID
        }

        // console.log(trainingRequest)
        // each train take 8 seconds for complete
        console.log('YOU HAVE 8 SECONDS FOR THIS TRAIN')
        console.log('\r\n')
        
        let socket = this.socket
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(trainingRequest))
            socket.on('message', (data)=>{
                // console.log('inside training ', data)
                try {
                    if (JSON.parse(data)[id]==TRAINING_ID){
                        console.log(data)
                    }  
                } catch (error) {}

                // incase status is start training, only resolve until see "MC_Succeeded"
                if (status == 'start'){
                    try {
                        if(JSON.parse(data)['sys'][1]=='MC_Succeeded'){
                            console.log('START TRAINING RESULT --------------------------------------')
                            console.log(data)
                            console.log('\r\n')
                            resolve(data)
                        }
                    } catch (error) {}
                }

                // incase status is accept training, only resolve until see "MC_Completed"
                if (status == 'accept'){
                    try {
                        if(JSON.parse(data)['sys'][1]=='MC_Completed'){
                            console.log('ACCEPT TRAINING RESULT --------------------------------------')
                            console.log(data)
                            console.log('\r\n')
                            resolve(data)
                        }
                    } catch (error) {}
                }
            })
        })
    }

    /**
     * - check login and grant access
     * - create profile if not yet exist
     * - load profile
     * - sub stream 'sys' for training
     * - train for actions, each action in number of time
     * 
     */
    train(profileName, trainingActions, numberOfTrain){
        this.socket.on('open',async ()=>{

            console.log("start training flow")
            
            // check login and grant access
            await this.checkGrantAccessAndQuerySessionInfo()

            // to training need subcribe 'sys' stream
            this.subRequest(['sys'], this.authToken, this.sessionId)

            // create profile 
            let status = "create";
            let createProfileResult = ""
            await this.setupProfile(this.authToken, 
                                    this.headsetId, 
                                    profileName, status).then((result)=>{createProfileResult=result})

            // load profile
            status = "load"
            let loadProfileResult = ""
            await this.setupProfile(this.authToken,
                                    this.headsetId, 
                                    profileName, status).then((result)=>{loadProfileResult=result})
            
            // training all actions
            let self = this

            for (let trainingAction of trainingActions){
                for (let numTrain=0; numTrain<numberOfTrain; numTrain++){
                    // start training for 'neutral' action
                    console.log(`START TRAINING "${trainingAction}" TIME ${numTrain+1} ---------------`)
                    console.log('\r\n')
                    await self.trainRequest(self.authToken, 
                                        self.sessionId, 
                                        trainingAction, 
                                        'start')

                    //
                    // FROM HERE USER HAVE 8 SECONDS TO TRAIN SPECIFIC ACTION
                    //
                    

                    // accept 'neutral' result
                    console.log(`ACCEPT "${trainingAction}" TIME ${numTrain+1} --------------------`)
                    console.log('\r\n')
                    await self.trainRequest(self.authToken, 
                                        self.sessionId, 
                                        trainingAction, 
                                        'accept')
                }
                
                let status = "save"
                let saveProfileResult = ""

                // save profile after train
                await self.setupProfile(self.authToken,
                                        self.headsetId, 
                                        profileName, status)
                                        .then((result)=>{
                                            saveProfileResult=result
                                            console.log(`COMPLETED SAVE ${trainingAction} FOR ${profileName}`)
                                        })                               
            }
        })
    }

    /**
     * 
     * - load profile which trained before
     * - sub 'com' stream (mental command)
     * - user think specific thing which used while training, for example 'push' action
     * - 'push' command should show up on mental command stream
     */
    live(profileName) {
        this.socket.on('open',async ()=>{

            await this.checkGrantAccessAndQuerySessionInfo()

            // load profile
            let loadProfileResult=""
            let status = "load"
            await this.setupProfile(this.authToken, 
                                    this.headsetId, 
                                    profileName, 
                                    status).then((result)=>{loadProfileResult=result})
            console.log(loadProfileResult)

            // // sub 'com' stream and view live mode
            this.subRequest(['com'], this.authToken, this.sessionId)

            this.socket.on('message', (data)=>{
                console.log(data)
            })
        })
    }
}

// ---------------------------------------------------------
let socketUrl = 'wss://localhost:6868'
let user = {
    "clientId":"tHOkopHWa8CUiBKJiKBtcr7hRaZpZCsnUYlKdyX2",
    "clientSecret":"Mp4XFxmRQEbOFpiehZeyl39WuNhDEayXlRLdjGgUircaHPeDIba4wEVtIfyLyRIOivq7qg2hKmf9WxnpY7Qe3w8FcpNfyr1661sP8whoVN3BIv4UI6Q7w0lmsyC9PSJN",
    "debit":5000
}



// ---------- training mental command for profile
// // train is do with a specific profile
// // if profile not yet exist, it will be created
// let profileName = 'test'

// // number of repeat train for each action
// // user have 8 seconds for each time of training
// let numberOfTrain = 1

// // always train 'neutral' complete first then train other action
// let trainingActions = ['neutral', 'push']

// c.train(profileName, trainingActions, numberOfTrain)


// ----------- go to live mode after train
// // load profile which already trained then test your mental command
// c.live(profileName)
// ---------------------------------------------------------


function ApplyColorTheme(engagement){
    let theme_prop = "workbench.colorTheme";
    let configuration = vscode.workspace.getConfiguration();
    let current_theme = configuration.get(theme_prop);
    let new_theme = "Abyss";
    if(engagement < 0.3){
        new_theme = "Red"
    }
    console.log(current_theme);
    console.log(new_theme);
    console.log(new_theme !== current_theme);
    // if(new_theme !== current_theme ){
        let update_global = true;
        configuration.update(theme_prop, new_theme, update_global);
        
        // Set the update global variable to be false in order to update workspace
        // when updating workspace uncommit the line below
        // if you try to update a workspace and no folder/project/file has been opened then it will error out.
        // vscode.user.applyEdit()
    // }
}

function checkForAlert(engagement){

    if(engagement < 0.3){
        vscode.window.showWarningMessage("Your engagement is below operating levels.");
    }
}

function appendCSV(data,filename){
    var newLine= "\r\n";
    var fields = ['Time',"AF3/theta","AF3/alpha","AF3/betaL","AF3/betaH","AF3/gamma","AF4/theta","AF4/alpha","AF4/betaL","AF4/betaH","AF4/gamma"];
    var toCsv = {
        header: false
    };
    fs.stat(filename, function (err, stat) {
        if (err == null) {
            var csv = parse(data,toCsv) + newLine;
            fs.appendFile(filename, csv, function (err) {
                if (err) throw err;
            });
        }
        else {
            //write the headers and newline
            console.log('New file, just writing headers');
            fields= (fields + newLine);

            fs.writeFile(filename, fields, function (err) {
                if (err) throw err;
                console.log('file saved');
            });
        }
    });
}
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "emotivestatusmetric" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.runBCI', function () {
		//Initialize Emotive cortex object

		let c = new Cortex(user, socketUrl)
        let streams = ['pow']
        appendCSV({},session_file);
		c.sub(streams,false);
    });
    context.subscriptions.push(disposable);
    
    let disposable2 = vscode.commands.registerCommand('extension.runBCI_Silent', function () {
        console.log("Running Silently!");
		let c = new Cortex(user, socketUrl)
        let streams = ['pow']
        appendCSV({},session_file);
		c.sub(streams,true)
	});

	context.subscriptions.push(disposable2);
}
exports.activate = activate;



// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
    activate,
	deactivate
}

