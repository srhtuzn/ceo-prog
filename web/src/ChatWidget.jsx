import { useState, useEffect, useRef } from "react";
import {
  Avatar,
  Button,
  Input,
  List,
  Badge,
  Popover,
  Upload,
  message,
  Tooltip,
  Modal,
  Select,
  Tag,
  Empty,
  Spin,
  Typography,
} from "antd";
import {
  MessageOutlined,
  SendOutlined,
  PaperClipOutlined,
  UsergroupAddOutlined,
  CloseOutlined,
  CheckCircleTwoTone,
  LoadingOutlined,
  MoreOutlined,
  FileTextOutlined,
  SmileOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import io from "socket.io-client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/tr";

dayjs.extend(relativeTime);
dayjs.locale("tr");

const { Text, Title } = Typography;
const { Option } = Select;

// Backend URL
const SOCKET_URL = "http://localhost:3000";
const API_URL = "http://localhost:3000";

let socket; // Socket instance'ı dışarıda tutuyoruz ki renderlarda kaybolmasın

export default function ChatWidget({ aktifKullanici }) {
  const [acik, setAcik] = useState(false);
  const [chats, setChats] = useState([]); // Sohbet Listesi
  const [activeChat, setActiveChat] = useState(null); // Şu an açık olan sohbet
  const [messages, setMessages] = useState([]); // Aktif sohbetin mesajları
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false); // Karşı taraf yazıyor mu?
  const [loadingChat, setLoadingChat] = useState(false);

  // Grup Kurma State'leri
  const [grupModal, setGrupModal] = useState(false);
  const [tumKullanicilar, setTumKullanicilar] = useState([]);
  const [yeniGrupAdi, setYeniGrupAdi] = useState("");
  const [secilenUyeler, setSecilenUyeler] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. SOCKET BAĞLANTISI VE EVENTLER
  useEffect(() => {
    if (!aktifKullanici) return;

    // Bağlan
    socket = io(SOCKET_URL);

    // Bağlantı kurulunca
    socket.on("connect", () => {
      console.log("🟢 Chat Sunucusuna Bağlanıldı ID:", socket.id);
    });

    // Mesaj Geldiğinde
    socket.on("receive_message", (msg) => {
      // Eğer şu an o sohbet açıksa mesajı ekrana bas
      if (activeChat && activeChat.id === msg.sohbet_id) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }

      // Sohbet listesini güncelle (Son mesajı ve tarihi değiştir, yukarı taşı)
      setChats((prevChats) => {
        const updatedChats = prevChats.map((c) =>
          c.id === msg.sohbet_id
            ? {
                ...c,
                son_mesaj:
                  msg.icerik ||
                  (msg.mesaj_tipi === "resim" ? "📷 Resim" : "📎 Dosya"),
                son_mesaj_tarihi: new Date(),
                okunmamis_sayisi:
                  activeChat?.id === msg.sohbet_id ? 0 : c.okunmamis_sayisi + 1,
              }
            : c
        );
        // Mesaj gelen sohbeti en üste al
        return updatedChats.sort(
          (a, b) => new Date(b.son_mesaj_tarihi) - new Date(a.son_mesaj_tarihi)
        );
      });
    });

    // Biri yazıyor...
    socket.on("display_typing", () => setIsTyping(true));
    socket.on("hide_typing", () => setIsTyping(false));

    return () => {
      socket.disconnect();
    };
  }, [activeChat, aktifKullanici]); // activeChat değişince listener'ın güncel kalması için

  // 2. SOHBET LİSTESİNİ ÇEK
  useEffect(() => {
    if (acik && aktifKullanici) {
      fetchChats();
    }
  }, [acik]);

  const fetchChats = async () => {
    const res = await fetch(`${API_URL}/chat/list?userId=${aktifKullanici.id}`);
    const data = await res.json();
    setChats(data);
  };

  // 3. SOHBETE GİR
  const enterChat = async (chat) => {
    setActiveChat(chat);
    setLoadingChat(true);

    // Odaya Katıl (Socket)
    socket.emit("join_room", chat.id);

    // Geçmişi Çek (HTTP)
    const res = await fetch(`${API_URL}/chat/history/${chat.id}`);
    const data = await res.json();
    setMessages(data);
    setLoadingChat(false);
    scrollToBottom();

    // Okunmamışları sıfırla (Frontend)
    setChats((prev) =>
      prev.map((c) => (c.id === chat.id ? { ...c, okunmamis_sayisi: 0 } : c))
    );
  };

  // 4. MESAJ GÖNDER
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const msgData = {
      sohbet_id: activeChat.id,
      gonderen_id: aktifKullanici.id,
      icerik: inputText,
      tip: "metin",
    };

    // Socket ile gönder (Veritabanına backend kaydedecek)
    await socket.emit("send_message", msgData);
    setInputText("");
    socket.emit("stop_typing", activeChat.id);
  };

  // 5. DOSYA GÖNDER
  const handleFileUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Önce HTTP ile yükle
      const res = await fetch(`${API_URL}/chat/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      // Sonra Socket ile yolunu gönder
      const msgData = {
        sohbet_id: activeChat.id,
        gonderen_id: aktifKullanici.id,
        icerik: null,
        tip: data.tip, // 'resim' veya 'dosya'
        dosya_yolu: data.dosya_yolu,
        dosya_adi: data.dosya_adi,
      };
      socket.emit("send_message", msgData);
    } catch (err) {
      message.error("Dosya yüklenemedi");
    }
  };

  // 6. GRUP OLUŞTURMA
  const createGroup = async () => {
    if (!yeniGrupAdi || secilenUyeler.length === 0)
      return message.warning("İsim ve üye seçin");

    const payload = {
      tip: "grup",
      ad: yeniGrupAdi,
      userIds: secilenUyeler,
      olusturanId: aktifKullanici.id,
    };

    const res = await fetch(`${API_URL}/chat/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      message.success("Grup oluşturuldu");
      setGrupModal(false);
      fetchChats(); // Listeyi yenile
      setYeniGrupAdi("");
      setSecilenUyeler([]);
    }
  };

  const kullanicilariGetir = async () => {
    if (tumKullanicilar.length === 0) {
      const res = await fetch(`${API_URL}/chat/users`);
      const data = await res.json();
      setTumKullanicilar(data.filter((u) => u.id !== aktifKullanici.id));
    }
  };

  // Helper: Scroll
  const scrollToBottom = () => {
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  };

  // Helper: Typing
  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (!isTyping) socket.emit("typing", activeChat.id);

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", activeChat.id);
    }, 2000);
  };

  // --- RENDER PARÇALARI ---

  // 1. Sohbet Listesi (Sol Taraf / Ana Ekran)
  const renderChatList = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: 15,
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          Mesajlar
        </Title>
        <Tooltip title="Yeni Grup Oluştur">
          <Button
            shape="circle"
            icon={<UsergroupAddOutlined />}
            onClick={() => {
              setGrupModal(true);
              kullanicilariGetir();
            }}
          />
        </Tooltip>
      </div>
      {/* Arama */}
      <div style={{ padding: "10px 15px" }}>
        <Input
          prefix={<SearchOutlined style={{ color: "#ccc" }} />}
          placeholder="Sohbet veya kişi ara..."
          style={{ borderRadius: 20, background: "#f5f5f5", border: "none" }}
        />
      </div>
      {/* Liste */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <List
          dataSource={chats}
          renderItem={(chat) => (
            <div
              onClick={() => enterChat(chat)}
              style={{
                padding: "12px 15px",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                transition: "0.2s",
                background:
                  chat.okunmamis_sayisi > 0 ? "#f6ffed" : "transparent",
                borderBottom: "1px solid #fcfcfc",
              }}
              className="chat-item-hover"
            >
              <Badge
                dot={chat.other_user_status === "Aktif"}
                color="green"
                offset={[-5, 35]}
              >
                <Avatar
                  size={45}
                  src={
                    chat.chat_avatar
                      ? `${API_URL}/uploads/${chat.chat_avatar}`
                      : null
                  }
                  style={{
                    backgroundColor:
                      chat.tip === "grup" ? "#722ed1" : "#1890ff",
                  }}
                >
                  {chat.chat_name?.[0]?.toUpperCase()}
                </Avatar>
              </Badge>
              <div style={{ marginLeft: 12, flex: 1 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text strong style={{ fontSize: 14 }}>
                    {chat.chat_name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(chat.son_mesaj_tarihi).format("HH:mm")}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, maxWidth: 180 }}
                    ellipsis
                  >
                    {chat.son_mesaj}
                  </Text>
                  {chat.okunmamis_sayisi > 0 && (
                    <Badge
                      count={chat.okunmamis_sayisi}
                      style={{ backgroundColor: "#52c41a" }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        />
        {chats.length === 0 && (
          <Empty
            description="Sohbet yok"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 50 }}
          />
        )}
      </div>
    </div>
  );

  // 2. Aktif Sohbet (Mesajlaşma Ekranı)
  const renderActiveChat = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "10px 15px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => setActiveChat(null)}
            style={{ marginRight: 5 }}
          />
          <Avatar
            src={
              activeChat.chat_avatar
                ? `${API_URL}/uploads/${activeChat.chat_avatar}`
                : null
            }
            style={{
              backgroundColor:
                activeChat.tip === "grup" ? "#722ed1" : "#1890ff",
            }}
          >
            {activeChat.chat_name[0]}
          </Avatar>
          <div style={{ marginLeft: 10 }}>
            <Text strong style={{ display: "block", lineHeight: 1 }}>
              {activeChat.chat_name}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {activeChat.tip === "grup" ? (
                "Grup Üyeleri"
              ) : isTyping ? (
                <span style={{ color: "#52c41a" }}>yazıyor...</span>
              ) : (
                "Çevrimiçi"
              )}
            </Text>
          </div>
        </div>
        <Button type="text" icon={<MoreOutlined />} />
      </div>

      {/* Mesajlar */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 15,
          background: "#e5ddd5",
        }}
      >
        {loadingChat ? (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Spin />
          </div>
        ) : (
          messages.map((msg, index) => {
            const ben = msg.gonderen_id === aktifKullanici.id;
            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: ben ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: ben ? "#dcf8c6" : "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    position: "relative",
                  }}
                >
                  {/* Grup ise gönderen ismini yaz */}
                  {!ben && activeChat.tip === "grup" && (
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 10,
                        display: "block",
                        marginBottom: 2,
                        color: "#e542a3",
                      }}
                    >
                      {msg.gonderen_adi}
                    </Text>
                  )}

                  {/* İçerik Tipi */}
                  {msg.mesaj_tipi === "resim" ? (
                    <div style={{ marginBottom: 5 }}>
                      <img
                        src={`${API_URL}/uploads/${msg.dosya_yolu}`}
                        alt="resim"
                        style={{
                          maxWidth: "100%",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          window.open(`${API_URL}/uploads/${msg.dosya_yolu}`)
                        }
                      />
                    </div>
                  ) : msg.mesaj_tipi === "dosya" ? (
                    <div
                      style={{
                        background: "rgba(0,0,0,0.05)",
                        padding: 8,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(`${API_URL}/uploads/${msg.dosya_yolu}`)
                      }
                    >
                      <FileTextOutlined
                        style={{ fontSize: 24, color: "#555" }}
                      />
                      <div>
                        <Text strong style={{ fontSize: 12 }}>
                          {msg.dosya_adi}
                        </Text>
                        <Text
                          type="secondary"
                          style={{ fontSize: 10, display: "block" }}
                        >
                          İndirmek için tıkla
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <Text style={{ fontSize: 14 }}>{msg.icerik}</Text>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 3,
                      marginTop: 2,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 9 }}>
                      {dayjs(msg.tarih).format("HH:mm")}
                    </Text>
                    {ben && (
                      <CheckCircleTwoTone
                        twoToneColor="#52c41a"
                        style={{ fontSize: 10 }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Alanı */}
      <div
        style={{
          padding: 10,
          background: "#f0f0f0",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Upload showUploadList={false} customRequest={handleFileUpload}>
          <Button shape="circle" icon={<PaperClipOutlined />} />
        </Upload>
        <Input
          value={inputText}
          onChange={handleTyping}
          onPressEnter={sendMessage}
          placeholder="Bir mesaj yazın..."
          style={{ borderRadius: 20 }}
          suffix={<SmileOutlined style={{ color: "#ccc" }} />}
        />
        <Button
          type="primary"
          shape="circle"
          icon={<SendOutlined />}
          onClick={sendMessage}
        />
      </div>
    </div>
  );

  // --- ANA RENDER ---
  return (
    <>
      {/* 1. YÜZEN BUTON */}
      <Popover
        content={
          <div
            style={{
              width: 380,
              height: 550,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              overflow: "hidden",
            }}
          >
            {activeChat ? renderActiveChat() : renderChatList()}
          </div>
        }
        title={null}
        trigger="click"
        open={acik}
        onOpenChange={setAcik}
        placement="topRight"
        overlayInnerStyle={{ padding: 0, borderRadius: 12, overflow: "hidden" }}
        arrow={false}
      >
        <div style={{ position: "fixed", bottom: 30, right: 30, zIndex: 1000 }}>
          <Badge
            count={chats.reduce((acc, c) => acc + c.okunmamis_sayisi, 0)}
            offset={[-5, 5]}
          >
            <Button
              type="primary"
              shape="circle"
              size="large"
              style={{
                width: 60,
                height: 60,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                fontSize: 24,
              }}
              icon={acik ? <CloseOutlined /> : <MessageOutlined />}
            />
          </Badge>
        </div>
      </Popover>

      {/* 2. GRUP KURMA MODALI */}
      <Modal
        title="Yeni Grup Oluştur"
        open={grupModal}
        onCancel={() => setGrupModal(false)}
        onOk={createGroup}
        okText="Oluştur"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <Input
            placeholder="Grup Konusu / Adı"
            prefix={<UsergroupAddOutlined />}
            value={yeniGrupAdi}
            onChange={(e) => setYeniGrupAdi(e.target.value)}
          />
          <div>
            <Text strong>Katılımcılar:</Text>
            <Select
              mode="multiple"
              style={{ width: "100%" }}
              placeholder="Kişileri seçin"
              onChange={setSecilenUyeler}
              value={secilenUyeler}
            >
              {tumKullanicilar.map((u) => (
                <Option key={u.id} value={u.id}>
                  <Avatar
                    size="small"
                    src={u.avatar ? `${API_URL}/uploads/${u.avatar}` : null}
                    style={{ marginRight: 5 }}
                  >
                    {u.ad_soyad[0]}
                  </Avatar>
                  {u.ad_soyad}
                </Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>
    </>
  );
}
