﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection': 'keep-alive',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
};

function main () {
    var prefs = AnyBalance.getPreferences ();
	
    var baseurl = 'https://old.evroopt.by/';
    if(!prefs.login)
        throw new AnyBalance.Error('Введите № карты');
	
    var html = AnyBalance.requestGet(baseurl + 'otchet-po-diskontnoj-karte-2', g_headers);
    if (!html || AnyBalance.getLastStatusCode() > 400) {
        AnyBalance.trace(html);
        throw new AnyBalance.Error('Ошибка при подключении к сайту провайдера! Попробуйте обновить данные позже.');
    }
    var form = getParam(html, null, null, /<div[^>]+class="enter_number_form"[^>]*>([\s\S]*?)<\/form>/i);
    if(!form){
	AnyBalance.trace(html);
        throw new AnyBalance.Error('Не удалось найти форму ввода номера карты. Сайт изменен?');
    }

    var params = createFormParams(form, function(params, input, name, value){
        var dt = new Date();
        if(name == 'cardnum')
            value = prefs.login;
        else if(name == 'from_date')
            value = '1.' + (dt.getMonth()+1) + '.' + dt.getFullYear();
        else if(name == 'to_date')
            value = dt.getDate() + '.' + (dt.getMonth()+1) + '.' + dt.getFullYear();
        else if(name == 'captcha[input]'){
            var captchaid = getParam(form, null, null, /<input[^>]+value="([^"]*)"[^>]*id="captcha-id"/i, null, html_entity_decode);
            var captchaimg = AnyBalance.requestGet(baseurl + 'images/captcha/' + captchaid + '.png');
            value = AnyBalance.retrieveCode("Пожалуйста, введите код с картинки.", captchaimg);
        }
       
        return value;
    });
	
    var html = AnyBalance.requestPost(baseurl + 'otchet-po-diskontnoj-karte-2', params, addHeaders({Referer: baseurl + 'otchet-po-diskontnoj-karte-2'}));
    
    if(!/<div[^>]*id="discount_report"/i.test(html)){
        var error = getParam(html, null, null, /<ul[^>]+class="errors"[^>]*>([\s\S]*?)<\/ul>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error, null, /Карточка с таким номером не найдена/i.test(error));
    
        error = getParam(html, null, null, /Вы не заполнили сведения о себе|Для идентификации пользователя/);
        if(error)
            throw new AnyBalance.Error("Евроопт требует заполнить форму регистрации. Вам необходимо зайти на сайт http://www.euroopt.by/otchet-po-diskontnoj-karte-2 через браузер и заполнить форму");

        error = getParam(html, null, null, /<h1[^>]*>\s*An error occurred/i);
        if(error){
        	error = getParam(html, null, null, /<b[^>]*>\s*Message:([\s\S]*?)<\/p>/i, replaceTagsAndSpaces, html_entity_decode);
        	AnyBalance.trace('Системная ошибка на стороне Евроопта: ' + error);
        	throw new AnyBalance.Error("Системная ошибка на сайте евроопт. Обращайтесь в их службу поддержки.");
        }
		
        AnyBalance.trace(html);
        throw new AnyBalance.Error('Не удалось получить данные по карте. Сайт изменен?');
    }

    var result = {success: true};

    getParam(html, result, 'status', /Текущий накопленный процент[^<]*<big[^>]*>([^<]*)/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'sum', /Общая сумма покупок(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    //getParam(html, result, 'skidka', /<tr[^>]*class="itog"(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);

    AnyBalance.setResult (result);
}
