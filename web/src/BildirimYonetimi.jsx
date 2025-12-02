import { useState, useEffect, useRef } from "react";
import {
  Popover,
  Badge,
  Button,
  List,
  Tabs,
  Typography,
  Avatar,
  Empty,
  Tooltip,
} from "antd";
import {
  BellOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  AlertOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/tr";

dayjs.extend(relativeTime);
dayjs.locale("tr");

const { Text } = Typography;
const API_URL = "http://localhost:3000";

export default function BildirimYonetimi({ aktifKullanici, onNavigasyon }) {
  const [bildirimler, setBildirimler] = useState([]);
  const [acik, setAcik] = useState(false);
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (aktifKullanici) {
      veriCek();
      // 30 saniyede bir kontrol et
      intervalRef.current = setInterval(veriCek, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [aktifKullanici]);

  const veriCek = async () => {
    try {
      const res = await fetch(
        `${API_URL}/dashboard/bildirimler?kime=${aktifKullanici.ad_soyad}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setBildirimler(data);
        // Okunmamışları say
        setOkunmamisSayisi(data.filter((b) => !b.okundu).length);
      }
    } catch (error) {
      console.error("Bildirim hatası:", error);
    }
  };

  // --- DÜZELTİLEN KISIM: TEKİL OKUMA ---
  const bildirimTikla = async (item) => {
    // 1. Önce popover'ı kapat ve yönlendir (Hız için)
    setAcik(false);
    if (item.gorev_id) {
      onNavigasyon(item.gorev_id);
    }

    // 2. Eğer zaten okunduysa işlem yapma
    if (item.okundu) return;

    // 3. Backend'e "Okundu" bilgisini gönder
    try {
      await fetch(`${API_URL}/dashboard/bildirimler/${item.id}/oku`, {
        method: "PUT",
      });

      // 4. State'i anında güncelle (Sayacı düşür, rengi değiştir)
      const guncelListe = bildirimler.map((b) =>
        b.id === item.id ? { ...b, okundu: true } : b
      );
      setBildirimler(guncelListe);
      setOkunmamisSayisi((prev) => (prev > 0 ? prev - 1 : 0));
    } catch (error) {
      console.error("Okuma hatası:", error);
    }
  };
  // -------------------------------------

  const hepsiniOkunduIsaretle = async () => {
    if (okunmamisSayisi === 0) return;
    try {
      await fetch(
        `${API_URL}/dashboard/bildirimler/hepsini-oku?kime=${aktifKullanici.ad_soyad}`,
        { method: "PUT" }
      );
      const guncelBildirimler = bildirimler.map((b) => ({
        ...b,
        okundu: true,
      }));
      setBildirimler(guncelBildirimler);
      setOkunmamisSayisi(0);
    } catch (error) {
      console.error("Hepsini oku hatası:", error);
    }
  };

  const renderListe = (data) => (
    <List
      dataSource={data}
      size="small"
      style={{ maxHeight: "400px", overflowY: "auto", minWidth: "300px" }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Bildirim yok"
          />
        ),
      }}
      renderItem={(item) => (
        <List.Item
          onClick={() => bildirimTikla(item)}
          style={{
            cursor: "pointer",
            padding: "12px",
            borderBottom: "1px solid #f0f0f0",
            background: item.okundu ? "#fff" : "#e6f7ff", // Okunmamışlar mavi
            transition: "background 0.3s",
          }}
        >
          <List.Item.Meta
            avatar={
              <Avatar
                style={{
                  backgroundColor: item.okundu ? "#ccc" : "#1890ff",
                }}
                icon={
                  item.mesaj.includes("onay") ? (
                    <CheckCircleOutlined />
                  ) : item.mesaj.includes("red") ||
                    item.mesaj.includes("gecik") ? (
                    <AlertOutlined />
                  ) : (
                    <MessageOutlined />
                  )
                }
              />
            }
            title={
              <Text strong={!item.okundu} style={{ fontSize: "13px" }}>
                {item.mesaj}
              </Text>
            }
            description={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <Text type="secondary" style={{ fontSize: "11px" }}>
                  {dayjs(item.tarih).fromNow()}
                </Text>
                {!item.okundu && <Badge status="processing" />}
              </div>
            }
          />
        </List.Item>
      )}
    />
  );

  const popoverContent = (
    <div style={{ width: 350 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 10px 10px 10px",
          borderBottom: "1px solid #eee",
        }}
      >
        <Text strong>Bildirimler</Text>
        {okunmamisSayisi > 0 && (
          <Tooltip title="Hepsini okundu işaretle">
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={hepsiniOkunduIsaretle}
            >
              Tümünü Oku
            </Button>
          </Tooltip>
        )}
      </div>
      <Tabs
        defaultActiveKey="1"
        centered
        size="small"
        items={[
          {
            key: "1",
            label: `Tümü`,
            children: renderListe(bildirimler),
          },
          {
            key: "2",
            label: `Okunmamış (${okunmamisSayisi})`,
            children: renderListe(bildirimler.filter((b) => !b.okundu)),
          },
        ]}
      />
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={acik}
      onOpenChange={setAcik}
      placement="bottomRight"
      arrow={false}
    >
      <Badge count={okunmamisSayisi} overflowCount={99}>
        <Button
          shape="circle"
          icon={<BellOutlined />}
          size="large"
          style={{ border: "none", boxShadow: "none" }}
        />
      </Badge>
    </Popover>
  );
}
