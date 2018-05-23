const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const util = require('util');

const ratingSelector = '#pageContent > div:nth-child(3) > div.userbox > div.info > ul > li:nth-child(1) > span';
const options = readJson('options.json');
let cache = {};
let remind_list = {};

function readJson(filename){
    if(!fs.existsSync(filename)){
        return {};
    }
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function writeJson(filename, obj) {
    if(!fs.existsSync(filename)){
        fs.closeSync(fs.openSync(filename, 'w'));
    }
    return fs.writeFileSync(filename, JSON.stringify(obj, null, 4));
}

function getLastRatting(name) {
    cache = readJson('cache.json');
    if(cache[name] && cache[name]['ratting']){
        return parseInt(cache[name]['ratting']);
    }
    return -1;
}

function setLastRatting(name, ratting) {
    if(!cache[name]){
        cache[name] = {};
    }
    cache[name]['ratting'] = parseInt(ratting);
    writeJson('cache.json', cache);
}

function generateMailBody(name, rating, lastRatting){
    return  util.format('<a href="%s">%s</a><p>当前Ratting: %d(%s%d)</p>',
        'http://codeforces.com/profile/' + name,
        name,
        rating,
        rating >= lastRatting ? '+' : '',
        rating - lastRatting
    );
}

async function mail(name, rating, lastRatting, email){
    let transporter = nodemailer.createTransport({
        // host: 'smtp.ethereal.email',
        service: 'qq', // 使用了内置传输发送邮件 查看支持列表：https://nodemailer.com/smtp/well-known/
        port: 465, // SMTP 端口
        secureConnection: true, // 使用了 SSL
        auth: {
            user: options['sender_email'],
            // 这里密码不是qq密码，是你设置的smtp授权码
            pass: options['sender_auth'],
        }
    });

    let mailOptions = {
        from: util.format('"%s" <%s>', options['sender_name'], options['sender_email']), // sender address
        to: email, // list of receivers
        subject: options['email_subject'], // Subject line
        // 发送text或者html格式
        // text: 'Hello world?', // plain text body
        html: generateMailBody(name, rating, lastRatting)
    };

    // send mail with defined transport object
    return new Promise((resolve, reject) =>{
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject(error);
                return;
            }
            console.log('Mail has sent to %s(%s)', name, email);
            resolve(info);
        });
    });
}

async function interceptPage(page){
    await page.setRequestInterception(true);
    // 拦截图片、css，因为页面不需要渲染
    // 拦截MAINFRM.aspx，因为只需要保持cookie，不需要在主页做操作
    // 拦截ValidateCode.aspx，因为不需要验证码
    let interceptions = ['.png', '.gif', '.jpg', 'ico', '.css', '.js']
    page.on('request', req => {
        for(let i = 0; i < interceptions.length; i++){
            if(req.url().endsWith(interceptions[i])){
                req.abort();
                return;
            }
        }
        req.continue();
    });
}

async function checkRatting(page, name, email){
    await page.goto('http://codeforces.com/profile/' + name);

    await page.waitForSelector(ratingSelector);
    let ratting = parseInt(await page.$eval(ratingSelector, span => {
        return span.innerHTML;
    }));

    let lastRatting = getLastRatting(name);

    console.log('%s current ratting: %d, last ratting %d', name, ratting, lastRatting);

    if(ratting !== lastRatting){
        await mail(name, ratting, lastRatting, email);
        setLastRatting(name, ratting);
        return true;
    }
    return false;
}

function checkRattingTask(page, period) {
    async function remind(page) {
        remind_list = readJson('remind_list.json');
        if(remind_list && remind_list['list']){
			console.log('checking %d users every %dms', remind_list['list'].length, period);
            for(let i = 0; i < remind_list['list'].length; i++){
                let p = remind_list['list'][i];
                await checkRatting(page, p['name'], p['email']);
            }
        }
    }
    setImmediate(remind, page);
    return setInterval(remind, period, page);
}

async function main() {
    const browser = await puppeteer.launch({headless: options['headless']});
	console.log('browser started');

    const page = await browser.newPage();
	console.log('new page');
    await interceptPage(page);

    checkRattingTask(page, options['check_period']);
}

main();
