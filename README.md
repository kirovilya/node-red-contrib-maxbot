# node-red-contrib-maxbot
Node-RED nodes for MAX messenger

### Changelog

#### 0.7.0
- Обновлена библиотека @maxhub/max-bot-api до версии 0.2.4 (сменился адрес API сервисов на platform-api2.max.ru)
- Добавлена поддержка сертификатов Минцифры для HTTPS-запросов

#### 0.6.1
- Исправления ошибок


### Примеры узлов function и данных отправляемых в узел maxbot-send

Отправить сообщение пользователю:
```
const data = `Привет!`;

return {
    payload: data,
    userId: msg.payload.userId,  // пользователь, кому написать
};
```


Отправить сообщение в чат:
```
const data = `Привет, ${msg.payload.data.sender.name}!`;

return {
    payload: data,
    chatId: msg.payload.chatId,  // чат, куда написать
};
```

Отправить сообщение в чат в ответ на исходное сообщение:
```
const data = {
    text: `Привет, ${msg.payload.data.sender.name}!`,
    link: { type: 'reply', mid: msg.payload.data.body.mid},   // ссылка на сообщение. на которое идет ответ
};

return {
    payload: data,
    chatId: msg.payload.chatId,  // чат, куда написать
};
```

Форматирование и клавиатура в сообщении: 
```
const data = {
    text: '**Привет!** _Добро пожаловать_ в [MAX](https://dev.max.ru).',
    format: 'markdown',
    attachments: [{
        type: 'inline_keyboard',
        payload: {
            buttons: [
               [
                  {type: 'callback', text: 'Проверка', payload: 'button1'},
                  {type: 'callback', text: 'Еще одна', payload: 'button2'}
               ],
               [
                  {type: 'link', text: 'Ссылка далеко-далеко', url: 'https://dev.max.ru'}
               ]
            ]
        }
    }]
};

return {
    payload: data,
    chatId: msg.payload.chatId,  // чат, куда написать
};
```

Выставить доступные команды:
```
const data = [
    {
        name: "menu",
        description: "Меню"
    },
    {
        name: "test",
        description: "Тест"
    },
];

return {commands: data};
```

Удаление сообщения по ID:
```
return {
    deleteId: msg.payload.data.body.mid,
};
```

Отправить фото по URL:
```
return {
    payload: {
        type: 'image',
        source: 'https://example.com/photo.jpg',
        text: 'Красивое фото'
    },
    chatId: msg.payload.chatId,
};
```

Отправить видео по URL:
```
return {
    payload: {
        type: 'video',
        source: 'https://example.com/video.mp4',
        text: 'Посмотри это видео!'
    },
    chatId: msg.payload.chatId,
};
```

Отправить файл по URL:
```
return {
    payload: {
        type: 'file',
        source: 'https://example.com/document.pdf'
    },
    chatId: msg.payload.chatId,
};
```

Отправить аудио по URL:
```
return {
    payload: {
        type: 'audio',
        source: 'https://example.com/audio.mp3'
    },
    chatId: msg.payload.chatId,
};
```

Отправить файл с локального пути:
```
return {
    payload: {
        type: 'file',
        source: '/path/to/document.pdf'
    },
    chatId: msg.payload.chatId,
};
```