const {
    Client,
    IntentsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ApplicationCommandOptionType,
    Colors,
    PermissionFlagsBits,
    ComponentType,
} = require("discord.js");
const { token } = require("./res/token.json");
const { baseGuild, category, manageChannel, manageVoice, clanCategory, manageClansChannel } = require("./res/config.json");
const { buttons } = require("./res/emojis.json");
const fs = require("fs");
const internal = require("stream");
const { channel } = require("diagnostics_channel");

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
    ],
});

const innerData = {
    buttons: ["changeAmount", "unLock", "rename", "give", "mute", "disconnect", "denyConnect", "bitrate"],
    buttonsClans: ["manageParticipant", "manageSubOwner", "changeName", "changeColor", "changeIcon", "giveOwner", "viewMembers"],
    owners_channels: new Map(),
    pendingInteractions: new Map(),
    delays: new Map(),
};

function toEmbed(description) {
    return new EmbedBuilder({ description: description, color: 0xca3a59 });
}

function writeClansInfo(clans) {
    let counter = 1;
    let str = "Кланы:\n------------------------------------------\n";
    for (const item of Object.entries(clans)) {
        str += `${counter++}. Роль: <@&${item[0]}>; Владелец: <@${item[1].owner}>;\nСовладельцы:`;
        if (item[1].subOwners.length != 0) for (const member of item[1]) str += ` <@${member}>`;
        else str += " отсутствуют";
        str += `\nГолосовой канал: <#${item[1].voice}>\n------------------------------------------\n`;
    }
    str = `Всего кланов: **${counter - 1}**\n` + str;
    return str;
}

function makeDelay(userId, customId) {
    if (innerData.delays.has(userId))
        innerData.delays.get(userId).push({ customId, date: new Date().getTime() + 20_000 }); //userId: [{customId, date},]
    else innerData.delays.set(userId, [{ customId, date: new Date().getTime() + 20_000 }]);
}

function makePended(interaction) {
    if (innerData.pendingInteractions.has(interaction.user.id)) {
        innerData.pendingInteractions.get(interaction.user.id).interaction.deleteReply();
        innerData.pendingInteractions.get(interaction.user.id).interaction = interaction;
        innerData.pendingInteractions.get(interaction.user.id).command = interaction.customId;
        innerData.pendingInteractions.get(interaction.user.id).date = new Date().getTime() + 60_000;
        return;
    }
    innerData.pendingInteractions.set(interaction.user.id, {
        interaction: interaction,
        command: interaction.customId,
        date: new Date().getTime() + 60_000,
    });
}

function notSoFast(interaction) {
    let date;
    if (
        !(
            innerData.delays.has(interaction.user.id) &&
            innerData.delays.get(interaction.user.id).find((el) => {
                if (el.customId == interaction.customId) {
                    date = el.date;
                    return true;
                }
                return false;
            })
        )
    )
        return false;
    interaction.reply({
        embeds: [toEmbed(`Не так быстро! Попробуйте снова через <t:${Math.round(date / 1_000)}:R>`)],
        ephemeral: true,
    });
    return true;
}

function sendEmbed(message) {
    message.channel.send({
        embeds: [
            new EmbedBuilder({
                title: "Управление личной комнатой",
                color: 0xca3a59,
                description: `Комната существует, пока в ней находится кто-либо. При отключении владельца комнаты её владение передаётся другому пользователю, находящемуся в канале.\n\n> **Описание кнопок:**\n
${buttons[innerData.buttons[0]]} — Изменить лимит пользователей\n
${buttons[innerData.buttons[1]]} — Закрыть/открыть комнату для всех пользователей\n
${buttons[innerData.buttons[2]]} — Переименовать канал\n
${buttons[innerData.buttons[3]]} — Передать права на владение комнатой\n
${buttons[innerData.buttons[4]]} — Запретить/разрешить пользователю _разговаривать_ в вашей комнате\n
${buttons[innerData.buttons[5]]} — Отключить пользователя от комнаты\n
${buttons[innerData.buttons[6]]} — Запретить/разрешить пользователю _подключаться_ к вашей комнате\n
${buttons[innerData.buttons[7]]} — Изменить битрейт канала`,
                footer: { text: "Для некоторых кнопок необходимо дополнительно ввести запрошенные операцией данные" },
            }),
        ],
        components: [
            new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[0]],
                        customId: innerData.buttons[0],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[1]],
                        customId: innerData.buttons[1],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[2]],
                        customId: innerData.buttons[2],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[3]],
                        customId: innerData.buttons[3],
                        style: ButtonStyle.Secondary,
                    }),
                ],
            }),
            new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[4]],
                        customId: innerData.buttons[4],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[5]],
                        customId: innerData.buttons[5],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[6]],
                        customId: innerData.buttons[6],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        emoji: buttons[innerData.buttons[7]],
                        customId: innerData.buttons[7],
                        style: ButtonStyle.Secondary,
                    }),
                ],
            }),
        ],
    });
}

function sendClanEmbed(message) {
    message.channel.send({
        embeds: [
            new EmbedBuilder({
                title: "Управление клановой комнатой",
                color: 0xca3a59,
                description: `Если вы видите это сообщение, значит вы имеете право на управление кланом`,
                footer: { text: "Для некоторых кнопок необходимо дополнительно ввести запрошенные операцией данные" },
            }),
        ],
        components: [
            new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        label: "Добавить/удалить участника",
                        customId: innerData.buttonsClans[0],
                        style: ButtonStyle.Primary,
                    }),
                    new ButtonBuilder({
                        label: "Добавить/удалить совладельца",
                        customId: innerData.buttonsClans[1],
                        style: ButtonStyle.Secondary,
                    }),
                ],
            }),
            new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        label: "Изменить название",
                        customId: innerData.buttonsClans[2],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        label: "Изменить цвет",
                        customId: innerData.buttonsClans[3],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        label: "Изменить иконку",
                        customId: innerData.buttonsClans[4],
                        style: ButtonStyle.Secondary,
                    }),
                    new ButtonBuilder({
                        label: "Передать владение",
                        customId: innerData.buttonsClans[5],
                        style: ButtonStyle.Danger,
                    }),
                ],
            }),
            new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        label: "Просмотр всех пользователей с ролью клана",
                        customId: innerData.buttonsClans[6],
                        style: ButtonStyle.Secondary,
                    }),
                ],
            }),
        ],
    });
}

async function updateCommand() {
    //room check + room delete + room view
    /*
    client.application.commands.edit(
        "1208903431465472041",
        {
            name: "room-create",
            description: "Создаёт роль и канал для роли",
            options: [
                {
                    name: "название",
                    description: "Название канала (может быть изменено владельем)",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: "владелец",
                    description: "Тег владельца",
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: "цвет",
                    description: "Цвет роли в формате hex (шесть символов: RRGGBB)",
                    type: ApplicationCommandOptionType.String,
                },
            ],
        },
        baseGuild
    );*/
    /*client.application.commands.create(
        {
            name: "room-delete",
            description: "Удаляет роль и канал для роли",
            options: [
                {
                    name: "роль",
                    description: "Роль клана",
                    type: ApplicationCommandOptionType.Role,
                    required: true
                }
            ],
        },
        baseGuild
    );*/
    /*client.application.commands.create(
        {
            name: "room-fix",
            description: "Исправляет несоответствия в каналах и ролях, которые оказались удалены вручную",
        },
        baseGuild
    ); */
    //client.application.commands.delete("1212413745620459580", baseGuild);
    //client.application.commands.create({ name: "room-view", description: "Просмотр всей хранимой в боте информации о кланах" }, baseGuild);
    /*client.application.commands.create(
        {
            name: "room-assign",
            description: "Создаёт клан из существующей роли",
            options: [
                { name: "роль", description: "К какой роли будет привязан клан", type: ApplicationCommandOptionType.Role, required: true },
                {
                    name: "владелец",
                    description: "Какой пользователь будет являться владельцем клана",
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
        baseGuild
    );*/
}

function formMembers(members, obj) {
    let str = `Всего участников: **${members.size}**\n-------------------------\nВладелец: <@${obj.owner}>\nСовладельцы:`;
    if (obj.subOwners.length === 0) str += " отсутствуют";
    else for (const item of obj.subOwners) str += ` <@${item}>`;
    let counter = 1;
    str += "\n-------------------------\nВсе обладатели роли:\n\n";
    for (const item of members) str += `${counter++}. <@${item[0]}>\n`;
    return str;
}

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isButton()) {
            if (interaction.channel.id === manageChannel) {
                if (!innerData.owners_channels.has(interaction.member.id)) {
                    interaction.reply({
                        embeds: [toEmbed(`Для начала, создайте свой приватный канал, перейдя в <#${manageVoice}>`)],
                        ephemeral: true,
                    });
                    return;
                }
                if (interaction.customId === innerData.buttons[1]) {
                    if (notSoFast(interaction)) return;
                    const channel = interaction.guild.channels.cache.get(innerData.owners_channels.get(interaction.member.id));
                    const permissions = channel.permissionOverwrites.cache;
                    if (
                        permissions.has(interaction.guild.roles.everyone.id) &&
                        permissions.get(interaction.guild.roles.everyone.id).deny.has("Connect")
                    ) {
                        channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: null });
                        interaction.reply({
                            embeds: [toEmbed("Теперь канал **доступен для всех**")],
                            ephemeral: true,
                        });
                    } else {
                        channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: false });
                        interaction.reply({
                            embeds: [toEmbed("Теперь канал **закрыт**")],
                            ephemeral: true,
                        });
                    }
                    makeDelay(interaction.user.id, interaction.customId);
                    return;
                }
                //answerable
                if (interaction.customId === innerData.buttons[0]) {
                    if (notSoFast(interaction)) return;
                    interaction.reply({
                        embeds: [toEmbed("Введите желаемое количество участников в чат (0 - неограничено)")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
                if (interaction.customId === innerData.buttons[2]) {
                    if (notSoFast(interaction)) return;
                    interaction.reply({
                        embeds: [toEmbed("Введите новое название комнаты в чат")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
                if (interaction.customId === innerData.buttons[3]) {
                    interaction.reply({
                        embeds: [toEmbed("Упомяните пользователя, которому хотите передать комнату")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
                if (interaction.customId === innerData.buttons[4]) {
                    if (notSoFast(interaction)) return;
                    interaction.reply({
                        embeds: [toEmbed("Упомяните пользователя, которому хотите запретить/разрешить говорить")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
                if (interaction.customId === innerData.buttons[5]) {
                    interaction.reply({
                        embeds: [toEmbed("Упомяните пользователя, которого хотите отключить от канала")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
                if (interaction.customId === innerData.buttons[6]) {
                    if (notSoFast(interaction)) return;
                    interaction.reply({
                        embeds: [toEmbed("Упомяните пользователя, которому хотите запретить подключаться к каналу")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
                if (interaction.customId === innerData.buttons[7]) {
                    if (notSoFast(interaction)) return;
                    interaction.reply({
                        embeds: [toEmbed("Введите желаемый битрейт в чат _(**от 8 до 384** кб/c, стандартное значение - **64** кб/c)_ ")],
                        ephemeral: true,
                    });
                    makePended(interaction);
                    return;
                }
            }
            if (interaction.customId === innerData.buttonsClans[0]) {
                //добавить/удалить роль
                //if (notSoFast(interaction)) return;
                interaction.reply({
                    embeds: [toEmbed("Тегните участника, которого вы хотите добавить/удалить в клане")],
                    ephemeral: true,
                });
                makePended(interaction);
                return;
            }
            if (interaction.customId === innerData.buttonsClans[1]) {
                //добавить/удалить совладельца
                //if (notSoFast(interaction)) return;
                interaction.reply({
                    embeds: [
                        toEmbed("Тегните участника, которому вы хотите назначить/снять права совладельца в клане").setFooter({
                            text: "Если упомянутый пользователь не является участником клана, он станет его участником и совладельцем",
                        }),
                    ],
                    ephemeral: true,
                });
                makePended(interaction);
                return;
            }
            if (interaction.customId === innerData.buttonsClans[2]) {
                //название
                if (notSoFast(interaction)) return;
                interaction.reply({
                    embeds: [toEmbed("Введите новое название в чат")],
                    ephemeral: true,
                });
                makePended(interaction);
                return;
            }
            if (interaction.customId === innerData.buttonsClans[3]) {
                //цвет
                if (notSoFast(interaction)) return;
                interaction.reply({
                    embeds: [
                        toEmbed("Введите новый цвет в чат").setFooter({
                            text: "Вводится в формате hex из шести символов: RRGGBB (Например, ca3a59)",
                        }),
                    ],
                    ephemeral: true,
                });
                makePended(interaction);
                return;
            }
            if (interaction.customId === innerData.buttonsClans[4]) {
                //иконка
                if (notSoFast(interaction)) return;
                interaction.reply({
                    embeds: [toEmbed("Скиньте картинку в чат, которую вы хотите использовать в качестве иконки")],
                    ephemeral: true,
                });
                makePended(interaction);
                return;
            }
            if (interaction.customId === innerData.buttonsClans[5]) {
                //передать владение
                if (notSoFast(interaction)) return;
                interaction.reply({
                    embeds: [
                        toEmbed("Упомяните пользователя, которому вы хотите передать владение").setFooter({
                            text: "После упоминания последует дополнительное подтверждение",
                        }),
                    ],
                    ephemeral: true,
                });
                makePended(interaction);
                return;
            }
            if (interaction.customId === innerData.buttonsClans[6]) {
                //просмотр ролистов
                if (notSoFast(interaction)) return;
                fs.readFile("src/clans.json", "utf8", async (err, data) => {
                    //roleId is key
                    if (err) return;
                    await interaction.deferReply({ ephemeral: true });
                    const clans = JSON.parse(data);
                    for (const item of Object.entries(clans)) {
                        if (item[1].owner === interaction.user.id || item[1].subOwners.includes(interaction.user.id)) {
                            const role = await interaction.guild.roles.fetch(item[0]);
                            const members = await interaction.guild.members.fetch();
                            const membersWithRole = members.filter((member) => member.roles.cache.has(role.id));
                            interaction.editReply({
                                embeds: [
                                    new EmbedBuilder({ description: `### Участники ${role}\n` + formMembers(membersWithRole, item[1]) }),
                                ],
                            });
                            return;
                        }
                    }
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder({
                                description: "Вы не имеете прав для такого запроса. Это может сделать только владелец и совладелец клана",
                            }),
                        ],
                    });
                });
                makeDelay(interaction.user.id, interaction.customId);
                return;
            }
        }
        if (interaction.isChatInputCommand()) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                interaction.reply({ embeds: [new EmbedBuilder({ description: "Недостаточно прав для выполнения данной команды" })] });
                return;
            }
            if (interaction.commandName === "room-create") {
                fs.readFile("src/clans.json", "utf8", async (err, data) => {
                    //roleId is key
                    if (err) return;
                    await interaction.deferReply();
                    const clans = JSON.parse(data);
                    const owner = interaction.options.get("владелец", true).user;
                    for (const item of Object.entries(clans)) {
                        if (item[1].owner === owner.id || item[1].subOwners.includes(owner.id)) {
                            interaction.editReply({
                                embeds: [
                                    new EmbedBuilder({
                                        title: "Невозможно сделать канал для такого владельца",
                                        description: `${owner} уже имеет права для управления <@&${item[0]}>`,
                                    }),
                                ],
                            });
                            return;
                        }
                    }
                    const manageChannel = await interaction.guild.channels.fetch(manageClansChannel);
                    const preParsedColor = parseInt(interaction.options.get("цвет") ? interaction.options.get("цвет").value : "", 16);
                    const role = await interaction.guild.roles.create({
                        name: interaction.options.get("название", true).value,
                        color: preParsedColor && !isNaN(preParsedColor) ? preParsedColor : Colors.Default,
                        reason: `Создание клана для ${owner.tag}`,
                    });
                    manageChannel.permissionOverwrites.create(owner, { ViewChannel: true });
                    const voice = await interaction.guild.channels.create({
                        name: role.name,
                        parent: clanCategory,
                        type: ChannelType.GuildVoice,
                        permissionOverwrites: [
                            {
                                id: role.id,
                                allow: [PermissionFlagsBits.Connect],
                            },
                            {
                                id: owner.id,
                                allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers],
                            },
                            {
                                id: interaction.guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.Connect],
                            },
                        ],
                    });
                    interaction.options.get("владелец", true).member.roles.add(role);
                    clans[role.id] = { owner: owner.id, subOwners: [], voice: voice.id };
                    fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder({
                                title: "Клан создан",
                                description: `Владелец: ${interaction.options.get("владелец").user}\nРоль (название канала): ${role}`,
                            }),
                        ],
                    });
                });
            }
            if (interaction.commandName === "room-delete") {
                fs.readFile("src/clans.json", "utf8", async (err, data) => {
                    if (err) return;
                    const role = interaction.options.get("роль", true).role;
                    const clans = JSON.parse(data);
                    for (const item of Object.entries(clans)) {
                        if (item[0] === role.id) {
                            const reply = await interaction.reply({
                                embeds: [
                                    toEmbed(`Вы уверенны, что хотите удалить клан <@&${item[0]}>?`).setFooter({
                                        text: "Отменить данное действие будет невозможно. У вас 30 секунд на подтверждение",
                                    }),
                                ],
                                components: [
                                    new ActionRowBuilder({
                                        components: [
                                            new ButtonBuilder({
                                                label: "Подтвердить",
                                                customId: "acceptClanDelete",
                                                style: ButtonStyle.Danger,
                                            }),
                                        ],
                                    }),
                                ],
                            });
                            const filter = (inter) => inter.user.id === interaction.user.id && inter.customId === "acceptClanDelete";
                            const collector = reply.createMessageComponentCollector({
                                componentType: ComponentType.Button,
                                filter,
                                max: 1,
                                time: 30_000,
                            });
                            collector.on("collect", async () => {
                                const channel = await interaction.guild.channels.fetch(manageClansChannel);
                                channel.permissionOverwrites.delete(item[1].owner);
                                for (const member of item[1].subOwners) channel.permissionOverwrites.delete(member);
                                const voice = await interaction.guild.channels.fetch(item[1].voice);
                                voice.delete();
                                delete clans[item[0]];
                                fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                                interaction.editReply({
                                    embeds: [
                                        toEmbed(`Клан \`${role.name}\` успешно удалён`).setFooter({
                                            text: "Удалите роль вручную, если нужно",
                                        }),
                                    ],
                                    components: [
                                        new ActionRowBuilder({
                                            components: [
                                                new ButtonBuilder({
                                                    label: "Подтверждено",
                                                    customId: "-1",
                                                    style: ButtonStyle.Danger,
                                                    disabled: true,
                                                }),
                                            ],
                                        }),
                                    ],
                                });
                            });
                            collector.on("end", (collected) => {
                                if (collected.first() && collected.first().isRepliable()) collected.first().deferUpdate();
                                else
                                    interaction.editReply({
                                        embeds: [toEmbed(`Время ожидания истекло`)],
                                        components: [
                                            new ActionRowBuilder({
                                                components: [
                                                    new ButtonBuilder({
                                                        label: "Подтвердить",
                                                        style: ButtonStyle.Danger,
                                                        customId: "-1",
                                                        disabled: true,
                                                    }),
                                                ],
                                            }),
                                        ],
                                    });
                            });
                            return;
                        }
                    }
                    interaction.reply({ embeds: [new EmbedBuilder({ description: "Роль не находится в БД бота" })] });
                });
            }
            if (interaction.commandName === "room-view") {
                fs.readFile("src/clans.json", "utf8", (err, data) => {
                    if (err) return;
                    const clans = JSON.parse(data);
                    interaction.reply({ embeds: [toEmbed(writeClansInfo(clans)).setTitle("Сводка по кланам")] });
                });
            }
            if (interaction.commandName === "room-fix") {
                await interaction.deferReply();
                const manageChannel = interaction.guild.channels.cache.get(manageClansChannel);
                console.log("ManageChannel correct");
                if (!manageChannel) {
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder({
                                description: "Не найден управляющий канал. Обратитесь к <@978368736719425636>, чтобы исправить это",
                            }),
                        ],
                    });
                    return;
                }
                const category = interaction.guild.channels.cache.get(clanCategory);
                if (!category) {
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder({
                                description: "Отсутствует категория для кланов. Обратитесь к <@978368736719425636>, чтобы исправить это",
                            }),
                        ],
                    });
                    return;
                }
                console.log("Category correct");
                fs.readFile("src/clans.json", "utf8", async (err, data) => {
                    if (err) return;
                    const clans = JSON.parse(data);
                    let log = "";
                    let changes = false;
                    for (const item of Object.entries(clans)) {
                        const role = await interaction.guild.roles.fetch(item[0]);
                        if (!role) {
                            log += `${item[0]} - роль не найдена\n`;
                            manageChannel.permissionOverwrites.delete(item[1].owner);
                            for (const member of item[1].subOwners) channel.permissionOverwrites.delete(member);
                            const voice = await interaction.guild.channels.fetch(item[1].voice);
                            if (voice) voice.delete();
                            delete clans[item[0]];
                            changes = true;
                        } else {
                            let voice = interaction.guild.channels.cache.get(item[1].voice);
                            if (!voice) {
                                voice = await interaction.guild.channels.create({
                                    name: role.name,
                                    parent: category,
                                    type: ChannelType.GuildVoice,
                                    permissionOverwrites: [
                                        {
                                            id: role.id,
                                            allow: [PermissionFlagsBits.Connect],
                                        },
                                        {
                                            id: item[1].owner,
                                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers],
                                        },
                                        {
                                            id: interaction.guild.roles.everyone.id,
                                            deny: [PermissionFlagsBits.Connect],
                                        },
                                    ],
                                });
                                log += `<@&${item[0]}> - восстановлен голосовой канал - ${voice}\n`;
                                clans[item[0]].voice = voice.id;
                                changes = true;
                            }
                        }
                    }
                    if (changes) fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                    interaction.editReply({ embeds: [toEmbed(changes ? log : "Всё в порядке")] });
                });
            }
            if (interaction.commandName === "room-assign") {
                fs.readFile("src/clans.json", "utf8", async (err, data) => {
                    if (err) return;
                    await interaction.deferReply();
                    const clans = JSON.parse(data);
                    const owner = interaction.options.get("владелец", true).user;
                    const role = interaction.options.get("роль", true).role;
                    for (const item of Object.entries(clans)) {
                        if (item[1].owner === owner.id || item[1].subOwners.includes(owner.id)) {
                            interaction.editReply({
                                embeds: [
                                    new EmbedBuilder({
                                        title: "Невозможно сделать канал для такого владельца",
                                        description: `${owner} уже имеет права для управления <@&${item[0]}>`,
                                    }),
                                ],
                            });
                            return;
                        }
                        if (item[0] === role.id) {
                            interaction.editReply({
                                embeds: [
                                    new EmbedBuilder({
                                        title: "Роль уже является кланом",
                                        description: `<@&${item[0]}> находится во владении <@${item[1].owner}>`,
                                    }),
                                ],
                            });
                            return;
                        }
                    }
                    const manageChannel = await interaction.guild.channels.fetch(manageClansChannel);
                    manageChannel.permissionOverwrites.create(owner, { ViewChannel: true });
                    const voice = await interaction.guild.channels.create({
                        name: role.name,
                        parent: clanCategory,
                        type: ChannelType.GuildVoice,
                        permissionOverwrites: [
                            {
                                id: role.id,
                                allow: [PermissionFlagsBits.Connect],
                            },
                            {
                                id: owner.id,
                                allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers],
                            },
                            {
                                id: interaction.guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.Connect],
                            },
                        ],
                    });
                    interaction.options.get("владелец", true).member.roles.add(role);
                    clans[role.id] = { owner: owner.id, subOwners: [], voice: voice.id };
                    fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder({
                                title: "Клан создан",
                                description: `Владелец: ${interaction.options.get("владелец").user}\nРоль (название канала): ${role}`,
                            }),
                        ],
                    });
                });
            }
        }
    } catch (error) {
        console.log(error);
    }
});

client.on("messageCreate", async (message) => {
    try {
        if (message.channel.id === manageChannel) {
            if (!message.author.bot) message.delete("Очистка");
            if (message.content === "/~~create_embed22813371488001" && false) sendEmbed(message);
            if (innerData.pendingInteractions.has(message.author.id) && innerData.owners_channels.has(message.author.id)) {
                const command = innerData.pendingInteractions.get(message.author.id).command;
                if (command === innerData.buttons[0]) {
                    const num = Number(message.content);
                    if (num != NaN && num >= 0 && num <= 99) {
                        const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                        channel.setUserLimit(num);
                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                            embeds: [toEmbed(`Лимит участников установлен на: **${num > 0 ? num : "безлимит"}**`)],
                        });
                    } else return;
                } else if (command === innerData.buttons[2]) {
                    const newName = message.content.substring(0, 99);
                    if (newName.length > 0) {
                        const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                        channel.setName(newName);
                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                            embeds: [toEmbed(`Канал переименован (\`${channel.name}\` -> \`${newName}\`)`)],
                        });
                    } else return;
                } else if (command === innerData.buttons[3]) {
                    const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                    const pretendant = message.mentions.users.first();
                    if (pretendant) {
                        if (!channel.members.has(pretendant.id))
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [toEmbed(`Пользователь должен находиться в канале с вами`)],
                            });
                        else {
                            innerData.owners_channels.set(
                                message.mentions.users.first().id,
                                innerData.owners_channels.get(message.author.id)
                            );
                            innerData.owners_channels.delete(message.author.id);
                            innerData.pendingInteractions
                                .get(message.author.id)
                                .interaction.editReply({ embeds: toEmbed(`Новый владелец комнаты: ${pretendant}`) });
                            channel.send({
                                content: `<@${pretendant.id}>`,
                                embeds: [toEmbed(`Текущий владелец комнаты: ${pretendant}`)],
                            });
                        }
                    } else return;
                } else if (command === innerData.buttons[4]) {
                    const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                    const permissions = channel.permissionOverwrites.cache;
                    const pretendant = message.mentions.users.first();
                    if (pretendant) {
                        if (permissions.has(pretendant.id) && permissions.get(pretendant.id).deny.has("Speak")) {
                            channel.permissionOverwrites.edit(pretendant.id, { Speak: null });
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [
                                    toEmbed(`Теперь пользователю ${pretendant} **разрешено** говорить`).setFooter({
                                        text: "Переподключите пользователя для эффекта",
                                    }),
                                ],
                                ephemeral: true,
                            });
                        } else {
                            channel.permissionOverwrites.edit(pretendant.id, { Speak: false });
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [
                                    toEmbed(`Теперь пользователю ${pretendant} **запрещено** говорить`).setFooter({
                                        text: "Переподключите пользователя для эффекта",
                                    }),
                                ],
                                ephemeral: true,
                            });
                        }
                    } else return;
                } else if (command === innerData.buttons[5]) {
                    const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                    const pretendant = message.mentions.users.first();
                    if (pretendant) {
                        if (channel.members.has(pretendant.id)) {
                            channel.members.get(pretendant.id).voice.disconnect({ reason: `Отключен из комнаты ${pretendant.username}` });
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [toEmbed(`**Отключен пользователь: ${pretendant}**`)],
                            });
                        } else
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [toEmbed(`Пользователь должен находиться в канале с вами`)],
                            });
                    } else return;
                } else if (command === innerData.buttons[6]) {
                    const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                    const permissions = channel.permissionOverwrites.cache;
                    const pretendant = message.mentions.users.first();
                    if (pretendant) {
                        if (permissions.has(pretendant.id) && permissions.get(pretendant.id).deny.has("Connect")) {
                            channel.permissionOverwrites.edit(pretendant.id, { Connect: null });
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [
                                    toEmbed(`Теперь пользователю ${pretendant} **разрешено** подключаться`).setFooter({
                                        text: "Переподключите пользователя для эффекта",
                                    }),
                                ],
                                ephemeral: true,
                            });
                        } else {
                            channel.permissionOverwrites.edit(pretendant.id, { Connect: false });
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [
                                    toEmbed(`Теперь пользователю ${pretendant} **запрещено** подключаться`).setFooter({
                                        text: "Переподключите пользователя для эффекта",
                                    }),
                                ],
                                ephemeral: true,
                            });
                        }
                    } else return;
                } else if (command === innerData.buttons[7]) {
                    const num = Number(message.content);
                    if (num != NaN && num >= 8 && num <= 384) {
                        const channel = message.guild.channels.cache.get(innerData.owners_channels.get(message.author.id));
                        channel.setBitrate(num * 1000);
                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                            embeds: [toEmbed(`Установлен новый битрейт: **${num}** кб/c`)],
                        });
                    } else return;
                }
                makeDelay(message.author.id, command);
                innerData.pendingInteractions.delete(message.author.id);
            }
        }
        if (message.channel.id === manageClansChannel) {
            if (!message.author.bot) message.delete("Очистка");
            if (message.content === "/~~create_embed22813371488001" && false) sendClanEmbed(message);
            if (innerData.pendingInteractions.has(message.author.id)) {
                const command = innerData.pendingInteractions.get(message.author.id).command;
                if (command === innerData.buttonsClans[0]) {
                    if (message.mentions.users.first())
                        fs.readFile("src/clans.json", "utf8", async (err, data) => {
                            if (err) return;
                            const clans = JSON.parse(data);
                            for (const item of Object.entries(clans)) {
                                if (item[1].owner === message.author.id || item[1].subOwners.includes(message.author.id)) {
                                    const user = await message.guild.members.fetch(message.mentions.users.first().id);
                                    if (user.roles.cache.has(item[0])) {
                                        if (user.id === item[1].owner) {
                                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                                embeds: [toEmbed(`Невозможно удалить ${user}, так как он является владельцем клана`)],
                                            });
                                        } else if (item[1].subOwners.includes(message.author.id) && item[1].subOwners.includes(user.id)) {
                                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                                embeds: [
                                                    toEmbed(`Вы не можете удалить ${user}, так как он обладает теми же правами, что и вы`),
                                                ],
                                            });
                                        } else {
                                            user.roles.remove(item[0]);
                                            if (item[1].subOwners.includes(user.id)) {
                                                clans[item[0]].subOwners.splice(item[1].subOwners.indexOf(user.id), 1);
                                                fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                                                message.channel.permissionOverwrites.delete(user.id);
                                            }
                                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                                embeds: [toEmbed(`Теперь ${user} исключен из вашего клана`)],
                                            });
                                        }
                                    } else {
                                        if (user.user.bot) {
                                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                                embeds: [toEmbed(`Вы не можете добавить ${user}, так как это бот`)],
                                            });
                                            return;
                                        }
                                        user.roles.add(item[0]);
                                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                            embeds: [toEmbed(`Теперь ${user} является участником вашего клана`)],
                                        });
                                    }
                                    return;
                                }
                            }
                            innerData.pendingInteractions.delete(message.author.id);
                        });
                    else return;
                } else if (command === innerData.buttonsClans[1]) {
                    if (message.mentions.users.first())
                        fs.readFile("src/clans.json", "utf8", async (err, data) => {
                            if (err) return;
                            const clans = JSON.parse(data);
                            for (const item of Object.entries(clans)) {
                                if (item[1].owner === message.author.id) {
                                    const user = await message.guild.members.fetch(message.mentions.users.first().id);
                                    if (item[1].subOwners.includes(user.id)) {
                                        clans[item[0]].subOwners.splice(item[1].subOwners.indexOf(user.id), 1);
                                        fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                                        message.channel.permissionOverwrites.delete(user.id);
                                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                            embeds: [toEmbed(`${user} отныне не является совладельцем <@&${item[0]}>`)],
                                        });
                                    } else {
                                        if (user.user.bot) {
                                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                                embeds: [toEmbed(`Вы не можете добавить ${user}, так как это бот`)],
                                            });
                                            return;
                                        }
                                        clans[item[0]].subOwners.push(user.id);
                                        user.roles.add(item[0]);
                                        message.channel.permissionOverwrites.edit(user.id, { ViewChannel: true });
                                        fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                            embeds: [toEmbed(`Теперь ${user} является совладельцем <@&${item[0]}>`)],
                                        });
                                    }
                                    return;
                                }
                            }
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [toEmbed(`Назначать и управлять совладельцами может только владелец клана`)],
                            });
                            innerData.pendingInteractions.delete(message.author.id);
                        });
                    else return;
                } else if (command === innerData.buttonsClans[2]) {
                    const newName = message.content.substring(0, 99);
                    if (newName.length > 0) {
                        fs.readFile("src/clans.json", "utf8", async (err, data) => {
                            if (err) return;
                            const clans = JSON.parse(data);
                            for (const item of Object.entries(clans)) {
                                if (item[1].owner === message.author.id || item[1].subOwners.includes(message.author.id)) {
                                    const channel = await message.guild.channels.fetch(item[1].voice);
                                    const role = await message.guild.roles.fetch(item[0]);
                                    channel.setName(newName);
                                    role.setName(newName);
                                    innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                        embeds: [toEmbed(`Клан переименован: \`${role.name}\` -> \`${newName}\``)],
                                    });
                                    return;
                                }
                            }
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [toEmbed(`Переименовывать клан могут только его владелец и совладельцы`)],
                            });
                            innerData.pendingInteractions.delete(message.author.id);
                        });
                        makeDelay(message.author.id, command);
                    } else return;
                } else if (command === innerData.buttonsClans[3]) {
                    let substr = message.content.substring(-6);
                    if (substr === 6) {
                        const preParsedColor = parseInt(substr, 16);
                        if (!isNaN(preParsedColor)) {
                            fs.readFile("src/clans.json", "utf8", async (err, data) => {
                                if (err) return;
                                const clans = JSON.parse(data);
                                for (const item of Object.entries(clans)) {
                                    if (item[1].owner === message.author.id || item[1].subOwners.includes(message.author.id)) {
                                        const role = await message.guild.roles.fetch(item[0]);
                                        role.setColor(preParsedColor);
                                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                            embeds: [toEmbed(`Цвет ${role} успешно изменён`).setColor(preParsedColor)],
                                        });
                                        innerData.pendingInteractions.delete(message.author.id);
                                        return;
                                    }
                                }
                                innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                    embeds: [toEmbed(`Менять цвета могут только владельцы и совладельцы кланов`)],
                                });
                                innerData.pendingInteractions.delete(message.author.id);
                            });
                        }
                    } else return;
                } else if (command === innerData.buttonsClans[4]) {
                    const image = message.attachments.first();
                    if (image && image.contentType.includes("image")) {
                        fs.readFile("src/clans.json", "utf8", async (err, data) => {
                            if (err) return;
                            const clans = JSON.parse(data);
                            for (const item of Object.entries(clans)) {
                                if (item[1].owner === message.author.id || item[1].subOwners.includes(message.author.id)) {
                                    const role = await message.guild.roles.fetch(item[0]);
                                    role.setIcon(image.url);
                                    innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                        embeds: [toEmbed(`Иконка ${role} успешно изменена`)],
                                    });
                                    return;
                                }
                            }
                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                embeds: [toEmbed(`Менять иконку роли могут только владельцы и совладельцы кланов`)],
                            });
                            innerData.pendingInteractions.delete(message.author.id);
                        });
                    }
                } else if (command === innerData.buttonsClans[5]) {
                    const nextOwner = await message.guild.members.fetch(message.mentions.users.first().id);
                    if (message.mentions.users.first())
                        fs.readFile("src/clans.json", "utf8", async (err, data) => {
                            if (err) return;
                            const clans = JSON.parse(data);
                            for (const item of Object.entries(clans)) {
                                if (item[1].owner === message.author.id) {
                                    const reply = await innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                        embeds: [
                                            toEmbed(
                                                `Вы уверенны, что хотите передать владение <@&${item[0]}> пользователю ${nextOwner}?`
                                            ).setFooter({
                                                text: "Отменить данное действие будет невозможно. У вас 30 секунд на подтверждение",
                                            }),
                                        ],
                                        components: [
                                            new ActionRowBuilder({
                                                components: [
                                                    new ButtonBuilder({
                                                        label: "Подтвердить",
                                                        customId: "acceptOwnerChange",
                                                        style: ButtonStyle.Danger,
                                                    }),
                                                ],
                                            }),
                                        ],
                                    });
                                    const filter = (interaction) =>
                                        interaction.user.id === message.author.id && interaction.customId === "acceptOwnerChange";
                                    const collector = reply.createMessageComponentCollector({
                                        componentType: ComponentType.Button,
                                        filter,
                                        max: 1,
                                        time: 30_000,
                                    });
                                    collector.on("collect", () => {
                                        if (item[1].subOwners.includes(nextOwner.id)) {
                                            clans[item[0]].subOwners.splice(item[1].subOwners.indexOf(nextOwner.id), 1);
                                        }
                                        clans[item[0]].owner = nextOwner.id;
                                        clans[item[0]].subOwners.push(message.author.id);
                                        nextOwner.roles.add(item[0]);
                                        message.channel.permissionOverwrites.edit(nextOwner.id, { ViewChannel: true });
                                        fs.writeFileSync("src/clans.json", JSON.stringify(clans), "utf8");
                                        innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                            embeds: [
                                                toEmbed(`Клан передан новому владельцу: ${nextOwner}`).setFooter({
                                                    text: "Теперь вы являетесь совладельцем",
                                                }),
                                            ],
                                            components: [
                                                new ActionRowBuilder({
                                                    components: [
                                                        new ButtonBuilder({
                                                            label: "Подтверждено",
                                                            customId: "-1",
                                                            style: ButtonStyle.Danger,
                                                            disabled: true,
                                                        }),
                                                    ],
                                                }),
                                            ],
                                        });
                                    });
                                    collector.on("end", (collected) => {
                                        if (collected.first()) collected.first().deferUpdate();
                                        else
                                            innerData.pendingInteractions.get(message.author.id).interaction.editReply({
                                                embeds: [toEmbed(`Время ожидания истекло`)],
                                                components: [
                                                    new ActionRowBuilder({
                                                        components: [
                                                            new ButtonBuilder({
                                                                label: "Подтвердить",
                                                                customId: "-1",
                                                                style: ButtonStyle.Danger,
                                                                disabled: true,
                                                            }),
                                                        ],
                                                    }),
                                                ],
                                            });
                                        innerData.pendingInteractions.delete(message.author.id);
                                    });
                                }
                            }
                        });
                    else return;
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
        if (innerData.owners_channels.has(newState.member.id)) {
            if (newState.channelId === manageVoice) {
                newState.setChannel(oldState.channel);
            } else if (
                oldState.channelId === innerData.owners_channels.get(oldState.member.id) &&
                newState.channelId != oldState.channelId
            ) {
                if (oldState.channel.members.first()) {
                    innerData.owners_channels.set(oldState.channel.members.first().id, innerData.owners_channels.get(newState.member.id));
                    oldState.channel.send({
                        content: `<@${oldState.channel.members.first().id}>`,
                        embeds: [toEmbed(`Текущий владелец комнаты: <@${oldState.channel.members.first().id}>`)],
                    });
                } else if (oldState.channel) oldState.channel.delete("Канал без владельца");
                innerData.owners_channels.delete(newState.member.id);
            }
        } else if (newState.channelId === manageVoice) {
            const newChannel = await newState.guild.channels.create({
                name: newState.member.displayName,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parent,
                userLimit: 10,
                reason: `Создана комната для ${newState.member.user.username}`,
            });
            newState.setChannel(newChannel);
            innerData.owners_channels.set(newState.member.id, newChannel.id);
        }
    } catch (error) {
        console.log(error);
    }
});

client.on("ready", async (client) => {
    try {
        //updateCommand(client);
        console.log(`${client.user.username} is ready`);
        const guild = await client.guilds.fetch(baseGuild);
        const childrenToDelete = await guild.channels.fetch();
        childrenToDelete.delete(manageChannel);
        childrenToDelete.delete(manageVoice);
        for (const item of childrenToDelete) {
            if (item[1].parentId == category) {
                if (item[1].members.size > 0) {
                    childrenToDelete.delete(item[0]);
                    innerData.owners_channels.set(item[1].members.keys().next().value, item[0]);
                }
            } else childrenToDelete.delete(item[0]);
        }
        for (const item of childrenToDelete) item[1].delete("Канал без владельца");
        setInterval(() => {
            const requiredDate = new Date().getTime();
            for (const buttPress of innerData.pendingInteractions)
                if (buttPress[1].date < requiredDate) {
                    if (buttPress[1].interaction) buttPress[1].interaction.deleteReply();
                    innerData.pendingInteractions.delete(buttPress[0]);
                }
            for (const delays of innerData.delays)
                for (const object of delays[1]) {
                    if (object.date < requiredDate) innerData.delays.get(delays[0]).splice(delays[1].indexOf(object), 1);
                    if (innerData.delays.get(delays[0]).length === 0) innerData.delays.delete(delays[0]);
                }
        }, 10_000);
    } catch (error) {
        console.log(error);
    }
});

client.login(token);
