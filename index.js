
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  StringSelectMenuBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUPPORT_CHANNEL_ID = process.env.SUPPORT_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";

const commands = [
  new SlashCommandBuilder()
    .setName("painel-tickets")
    .setDescription("Publica o painel de suporte do AURO TICKETS.")
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`AURO TICKETS online como ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Comando /painel-tickets registrado.");
  } catch (error) {
    console.error("Erro ao registrar comando:", error);
  }
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "painel-tickets") return;

      if (!interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      )) {
        return interaction.reply({
          content: "Você precisa ser administrador para publicar o painel.",
          ephemeral: true
        });
      }

      const channel = await interaction.guild.channels.fetch(
        SUPPORT_CHANNEL_ID
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: "Configure SUPPORT_CHANNEL_ID com o ID do canal de texto.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("🎟️ AURO TICKETS")
        .setDescription(
          "Precisa de ajuda? Clique no botão abaixo para abrir seu atendimento.\n\n" +
          "• Explique seu problema à equipe.\n" +
          "• Aguarde um atendente.\n" +
          "• Ao terminar, avalie o atendimento de 1 a 5 estrelas."
        )
        .setFooter({ text: "AURO TICKETS • Central de suporte" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_open")
          .setLabel("Abrir atendimento")
          .setEmoji("🎟️")
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({ embeds: [embed], components: [row] });

      return interaction.reply({
        content: "Painel publicado no canal de suporte!",
        ephemeral: true
      });
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === "ticket_open") {
      const channel = await interaction.guild.channels.fetch(
        SUPPORT_CHANNEL_ID
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: "O canal de suporte não está configurado corretamente.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const thread = await channel.threads.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 80),
        type: ChannelType.PublicThread,
        message: {
          content: `🎟️ Atendimento de ${interaction.user}`
        },
        reason: `Ticket aberto por ${interaction.user.tag}`
      });

      await thread.members.add(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🎟️ Novo atendimento")
        .setDescription(
          `Olá, ${interaction.user}!\n\n` +
          "Descreva o motivo do atendimento e aguarde a equipe.\n\n" +
          "A equipe poderá ajudar você neste tópico."
        )
        .addFields({
          name: "Status",
          value: "🟢 Aberto"
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Fechar atendimento")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await thread.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.editReply({
        content: `Seu atendimento foi criado: ${thread}`
      });
    }

    if (interaction.customId === "ticket_close") {
      const thread = interaction.channel;

      if (!thread?.isThread()) {
        return interaction.reply({
          content: "Este botão só funciona dentro de um ticket.",
          ephemeral: true
        });
      }

      const isStaff = STAFF_ROLE_ID &&
        interaction.member.roles?.cache?.has(STAFF_ROLE_ID);

      const isOwner = thread.name ===
        `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 80);

      if (!isStaff && !isOwner &&
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageThreads
          )) {
        return interaction.reply({
          content: "Somente o autor ou a equipe pode fechar este ticket.",
          ephemeral: true
        });
      }

      const row = new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(stars =>
          new ButtonBuilder()
            .setCustomId(`ticket_rate_${stars}`)
            .setLabel(`${stars} estrela${stars > 1 ? "s" : ""}`)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      await interaction.reply({
        content: "🔒 Atendimento encerrado. Como você avalia o atendimento?",
        components: [row]
      });

      await thread.setLocked(true, "Atendimento encerrado");
      await thread.setArchived(true, "Atendimento encerrado");
      return;
    }

    if (interaction.customId.startsWith("ticket_rate_")) {
      const rating = Number(interaction.customId.split("_").pop());

      if (rating < 1 || rating > 5) {
        return interaction.reply({
          content: "Avaliação inválida.",
          ephemeral: true
        });
      }

      return interaction.update({
        content: `Obrigado por avaliar o AURO TICKETS com ${"⭐".repeat(rating)}!`,
        components: []
      });
    }
  } catch (error) {
    console.error(error);

    const response = {
      content: "Ocorreu um erro. Confira as configurações do bot e as permissões.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !SUPPORT_CHANNEL_ID) {
  console.error("Configure DISCORD_TOKEN, CLIENT_ID, GUILD_ID e SUPPORT_CHANNEL_ID.");
} else {
  client.login(TOKEN);
}
