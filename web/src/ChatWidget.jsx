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
  Dropdown,
  Menu,
  Space,
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
  UserAddOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import io from "socket.io-client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/tr";

dayjs.extend(relativeTime);
dayjs.locale("tr");

const { Text, Title } = Typography;
const { Option } = Select;

const SOCKET_URL = "http://localhost:3000";
const API_URL = "http://localhost:3000";

let socket;

export default function ChatWidget({ aktifKullanici }) {
  const [acik, setAcik] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Modallar ve Düzenleme
  const [grupModal, setGrupModal] = useState(false);
  const [yeniMesajModal, setYeniMesajModal] = useState(false);
  const [editMode, setEditMode] = useState(null); // { id: 1, text: "..." } veya null

  const [tumKullanicilar, setTumKullanicilar] = useState([]);
  const [yeniGrupAdi, setYeniGrupAdi] = useState("");
  const [secilenUyeler, setSecilenUyeler] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!aktifKullanici) return;
    socket = io(SOCKET_URL);

    socket.on("connect", () => {
      if (activeChat) {
        socket.emit("join_room", activeChat.id);
        // Bağlanınca hemen görüldü at
        socket.emit("mark_seen", {
          sohbet_id: activeChat.id,
          okuyan_id: aktifKullanici.id,
        });
      }
    });

    socket.on("receive_message", (msg) => {
      if (msg.gonderen_id === aktifKullanici.id) return;

      if (activeChat && activeChat.id === msg.sohbet_id) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
        // Sohbet açıksa anında görüldü yap
        socket.emit("mark_seen", {
          sohbet_id: activeChat.id,
          okuyan_id: aktifKullanici.id,
        });
      }
      updateChatList(msg);
    });

    // MESAJ GÜNCELLENDİ (DÜZENLEME/SİLME)
    socket.on("message_updated", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
      );
    });

    // MESAJLAR GÖRÜLDÜ (MAVİ TİK)
    socket.on("messages_seen_update", ({ sohbet_id }) => {
      if (activeChat && activeChat.id === sohbet_id) {
        setMessages((prev) => prev.map((m) => ({ ...m, okundu: true })));
      }
    });

    socket.on("display_typing", () => setIsTyping(true));
    socket.on("hide_typing", () => setIsTyping(false));

    return () => {
      socket.disconnect();
    };
  }, [activeChat, aktifKullanici]);

  const updateChatList = (msg) => {
    setChats((prevChats) => {
      const chatExists = prevChats.find((c) => c.id === msg.sohbet_id);
      if (!chatExists) {
        fetchChats();
        return prevChats;
      }
      const updatedChats = prevChats.map((c) =>
        c.id === msg.sohbet_id
          ? {
              ...c,
              son_mesaj:
                msg.icerik ||
                (msg.mesaj_tipi === "resim" ? "📷 Resim" : "📎 Dosya"),
              son_mesaj_tarihi: new Date(),
              okunmamis_sayisi:
                activeChat && activeChat.id === msg.sohbet_id
                  ? 0
                  : c.okunmamis_sayisi + 1,
            }
          : c
      );
      return updatedChats.sort(
        (a, b) => new Date(b.son_mesaj_tarihi) - new Date(a.son_mesaj_tarihi)
      );
    });
  };

  useEffect(() => {
    if (acik && aktifKullanici) fetchChats();
  }, [acik]);

  const fetchChats = async () => {
    try {
      const res = await fetch(
        `${API_URL}/chat/list?userId=${aktifKullanici.id}`
      );
      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const enterChat = async (chat) => {
    setActiveChat(chat);
    setLoadingChat(true);
    socket.emit("join_room", chat.id);

    // Mesajları Çek
    const res = await fetch(`${API_URL}/chat/history/${chat.id}`);
    const data = await res.json();
    setMessages(data);
    setLoadingChat(false);
    scrollToBottom();

    // Görüldü İşaretle
    socket.emit("mark_seen", {
      sohbet_id: chat.id,
      okuyan_id: aktifKullanici.id,
    });

    setChats((prev) =>
      prev.map((c) => (c.id === chat.id ? { ...c, okunmamis_sayisi: 0 } : c))
    );
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // Eğer Düzenleme Modundaysak
    if (editMode) {
      socket.emit("edit_message", {
        mesajId: editMode.id,
        yeniIcerik: inputText,
      });
      setEditMode(null);
      setInputText("");
      return;
    }

    // Normal Gönderim
    const msgData = {
      sohbet_id: activeChat.id,
      gonderen_id: aktifKullanici.id,
      icerik: inputText,
      tip: "metin",
      tarih: new Date().toISOString(),
      okundu: false, // Yeni mesaj okunmamıştır
    };

    // Optimistic UI (Hemen ekrana bas)
    setMessages((prev) => [...prev, msgData]);
    scrollToBottom();
    updateChatList(msgData);

    socket.emit("send_message", msgData);
    setInputText("");
    socket.emit("stop_typing", activeChat.id);
  };

  // SİLME VE DÜZENLEME FONKSİYONLARI
  const mesajSil = (mesaj) => {
    // Süre kontrolü (15 dk)
    const fark = dayjs().diff(dayjs(mesaj.tarih), "minute");
    if (fark > 15)
      return message.warning("Mesaj 15 dakikadan eski, silinemez.");

    Modal.confirm({
      title: "Mesajı Sil",
      content: "Bu mesaj herkesten silinecek.",
      okText: "Sil",
      okType: "danger",
      cancelText: "Vazgeç",
      onOk: () => {
        socket.emit("delete_message", { mesajId: mesaj.id });
      },
    });
  };

  const mesajDuzenle = (mesaj) => {
    // Süre kontrolü yapılabilir, şimdilik serbest
    setEditMode({ id: mesaj.id, text: mesaj.icerik });
    setInputText(mesaj.icerik); // Inputa metni taşı
  };

  const iptalEdit = () => {
    setEditMode(null);
    setInputText("");
  };

  const handleFileUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_URL}/chat/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const msgData = {
        sohbet_id: activeChat.id,
        gonderen_id: aktifKullanici.id,
        icerik: null,
        tip: data.tip,
        dosya_yolu: data.dosya_yolu,
        dosya_adi: data.dosya_adi,
        tarih: new Date().toISOString(),
        okundu: false,
      };
      setMessages((prev) => [...prev, msgData]);
      scrollToBottom();
      socket.emit("send_message", msgData);
    } catch (err) {
      message.error("Hata");
    }
  };

  // ... (Grup Oluşturma, Özel Sohbet Başlatma, Silme aynı kaldı) ...
  const startPrivateChat = async (uid) => {
    const p = {
      tip: "ozel",
      ad: null,
      userIds: [uid],
      olusturanId: aktifKullanici.id,
    };
    const r = await fetch(`${API_URL}/chat/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (r.ok) {
      setYeniMesajModal(false);
      await fetchChats();
      setTimeout(() => message.success("Sohbet açıldı"), 500);
    }
  };
  const createGroup = async () => {
    if (!yeniGrupAdi || secilenUyeler.length === 0)
      return message.warning("Eksik");
    const p = {
      tip: "grup",
      ad: yeniGrupAdi,
      userIds: secilenUyeler,
      olusturanId: aktifKullanici.id,
    };
    const r = await fetch(`${API_URL}/chat/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (r.ok) {
      message.success("Grup kuruldu");
      setGrupModal(false);
      fetchChats();
      setYeniGrupAdi("");
      setSecilenUyeler([]);
    }
  };
  const deleteChat = () => {
    if (!activeChat) return;
    Modal.confirm({
      title: "Sohbeti Sil",
      content: "Emin misiniz?",
      okText: "Sil",
      okType: "danger",
      onOk: async () => {
        await fetch(`${API_URL}/chat/${activeChat.id}`, { method: "DELETE" });
        message.success("Silindi");
        setActiveChat(null);
        fetchChats();
      },
    });
  };
  const kullanicilariGetir = async () => {
    if (tumKullanicilar.length === 0) {
      const r = await fetch(`${API_URL}/chat/users`);
      const d = await r.json();
      setTumKullanicilar(d.filter((u) => u.id !== aktifKullanici.id));
    }
  };
  const scrollToBottom = () => {
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  };
  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (!isTyping) socket.emit("typing", activeChat.id);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", activeChat.id);
    }, 2000);
  };

  // MENU İÇERİĞİ (Mesaj Üzeri Dropdown)
  const getMessageMenu = (msg) => (
    <Menu>
      <Menu.Item
        key="edit"
        icon={<EditOutlined />}
        onClick={() => mesajDuzenle(msg)}
      >
        Düzenle
      </Menu.Item>
      <Menu.Item
        key="delete"
        icon={<DeleteOutlined />}
        danger
        onClick={() => mesajSil(msg)}
      >
        Sil (Herkesten)
      </Menu.Item>
    </Menu>
  );

  const renderChatList = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
        <Space>
          <Tooltip title="Yeni Mesaj">
            <Button
              shape="circle"
              icon={<UserAddOutlined />}
              onClick={() => {
                setYeniMesajModal(true);
                kullanicilariGetir();
              }}
            />
          </Tooltip>
          <Tooltip title="Yeni Grup">
            <Button
              shape="circle"
              icon={<UsergroupAddOutlined />}
              onClick={() => {
                setGrupModal(true);
                kullanicilariGetir();
              }}
            />
          </Tooltip>
        </Space>
      </div>
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
            description="Mesaj yok"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 50 }}
          />
        )}
      </div>
    </div>
  );

  const renderActiveChat = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
                "Grup"
              ) : isTyping ? (
                <span style={{ color: "#52c41a" }}>yazıyor...</span>
              ) : (
                "Çevrimiçi"
              )}
            </Text>
          </div>
        </div>
        <Dropdown
          menu={{
            items: [
              {
                key: "sil",
                label: "Sohbeti Sil",
                icon: <DeleteOutlined />,
                danger: true,
                onClick: deleteChat,
              },
            ],
          }}
          placement="bottomRight"
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </div>
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
            // Silinmiş mesaj kontrolü
            if (msg.silindi) {
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
                      padding: "6px 10px",
                      borderRadius: 8,
                      backgroundColor: "#f0f0f0",
                      color: "#999",
                      fontStyle: "italic",
                      fontSize: 12,
                    }}
                  >
                    <StopOutlined /> {msg.icerik}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: ben ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}
              >
                <Dropdown
                  menu={
                    ben
                      ? {
                          items: [
                            {
                              key: "edit",
                              icon: <EditOutlined />,
                              label: "Düzenle",
                              onClick: () => mesajDuzenle(msg),
                            },
                            {
                              key: "delete",
                              icon: <DeleteOutlined />,
                              label: "Sil",
                              danger: true,
                              onClick: () => mesajSil(msg),
                            },
                          ],
                        }
                      : { items: [] }
                  }
                  trigger={["contextMenu"]}
                  disabled={!ben}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      backgroundColor: ben ? "#dcf8c6" : "#fff",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      position: "relative",
                      cursor: ben ? "pointer" : "default",
                    }}
                  >
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

                    {msg.mesaj_tipi === "resim" ? (
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
                            İndir
                          </Text>
                        </div>
                      </div>
                    ) : (
                      <Text style={{ fontSize: 14 }}>{msg.icerik}</Text>
                    )}

                    {/* Düzenlendi Etiketi */}
                    {msg.duzenlendi && (
                      <span
                        style={{ fontSize: 10, color: "#999", marginLeft: 5 }}
                      >
                        (düzenlendi)
                      </span>
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
                      {/* Mavi Tik Mantığı */}
                      {ben &&
                        (msg.okundu ? (
                          <CheckCircleTwoTone
                            twoToneColor="#1890ff"
                            style={{ fontSize: 12 }}
                          />
                        ) : (
                          <CheckOutlined
                            style={{ fontSize: 12, color: "#999" }}
                          />
                        ))}
                    </div>
                  </div>
                </Dropdown>
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
        {editMode ? (
          <div
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}
          >
            <CloseOutlined
              onClick={iptalEdit}
              style={{ cursor: "pointer", color: "red" }}
            />
            <div style={{ flex: 1, fontWeight: "bold", color: "#1890ff" }}>
              Mesaj Düzenleniyor...
            </div>
          </div>
        ) : (
          <Upload showUploadList={false} customRequest={handleFileUpload}>
            <Button shape="circle" icon={<PaperClipOutlined />} />
          </Upload>
        )}
        <Input
          value={inputText}
          onChange={handleTyping}
          onPressEnter={sendMessage}
          placeholder={
            editMode ? "Düzenlenmiş mesajı yaz..." : "Bir mesaj yazın..."
          }
          style={{ borderRadius: 20 }}
          suffix={<SmileOutlined style={{ color: "#ccc" }} />}
        />
        <Button
          type="primary"
          shape="circle"
          icon={editMode ? <CheckOutlined /> : <SendOutlined />}
          onClick={sendMessage}
        />
      </div>
    </div>
  );

  return (
    <>
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
          <Select
            mode="multiple"
            style={{ width: "100%" }}
            placeholder="Katılımcılar"
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
      </Modal>

      <Modal
        title="Yeni Sohbet Başlat"
        open={yeniMesajModal}
        onCancel={() => setYeniMesajModal(false)}
        footer={null}
      >
        <List
          dataSource={tumKullanicilar}
          renderItem={(user) => (
            <List.Item
              onClick={() => startPrivateChat(user.id)}
              style={{ cursor: "pointer", padding: 10, borderRadius: 5 }}
              className="chat-item-hover"
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    src={
                      user.avatar ? `${API_URL}/uploads/${user.avatar}` : null
                    }
                    style={{ backgroundColor: "#1890ff" }}
                  >
                    {user.ad_soyad[0]}
                  </Avatar>
                }
                title={user.ad_soyad}
                description={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {user.departman}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
