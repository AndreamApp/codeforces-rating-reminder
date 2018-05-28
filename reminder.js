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

function getLastRating(name) {
    cache = readJson('cache.json');
    if(cache[name] && cache[name]['rating']){
        return parseInt(cache[name]['rating']);
    }
    return -1;
}

function setLastRating(name, rating) {
    if(!cache[name]){
        cache[name] = {};
    }
    cache[name]['rating'] = parseInt(rating);
    writeJson('cache.json', cache);
}

function generateMailBody(name, rating, lastRating){
    return  util.format('<a href="%s">%s</a> <p>rating: %d(%s%d)</p>',
        'http://codeforces.com/profile/' + name,
        name,
        rating,
        rating >= lastRating ? '+' : '-',
        lastRating < 0 ? 0 : Math.abs(rating - lastRating)
    );
}

async function mail(name, rating, lastRating, email){
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
        html: generateMailBody(name, rating, lastRating)
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

async function checkRating(page, name, email){
    await page.goto('http://codeforces.com/profile/' + name);

    await page.waitForSelector(ratingSelector);
    let rating = parseInt(await page.$eval(ratingSelector, span => {
        return span.innerHTML;
    }));

    let lastRating = getLastRating(name);

    console.log('%s: %d -> %d', name, rating, lastRating);

    if(rating !== lastRating){
        await mail(name, rating, lastRating, email);
        setLastRating(name, rating);
        return true;
    }
    return false;
}

function checkRatingTask(page, period) {
    async function remind(page) {
        remind_list = readJson('remind_list.json');
        if(remind_list && remind_list['list']){
            console.log('checking %d users every %dms', remind_list['list'].length, period);
            for(let i = 0; i < remind_list['list'].length; i++){
                let p = remind_list['list'][i];
                await checkRating(page, p['name'], p['email']);
            }
        }
    }
    setImmediate(remind, page);
    return setInterval(remind, period, page);
}

async function main() {
    const browser = await puppeteer.launch(
        {
            headless: options['headless'],
            args: ['--no-sandbox'] // run on linux without sandbox
        }
    );
    console.log('browser started');

    const page = await browser.newPage();
    console.log('new page');
    await interceptPage(page);

    checkRatingTask(page, options['check_period']);
}

main();
