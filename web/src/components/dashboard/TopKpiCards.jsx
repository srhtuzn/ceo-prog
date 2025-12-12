import React from "react";
import { Row, Col, Card, Progress, Space, Tag, Tooltip } from "antd";
import {
  DollarOutlined,
  AlertOutlined,
  FieldTimeOutlined,
  RiseOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

export default function TopKpiCards({
  veri,
  riskliIslerDetay,
  attendanceData,
  currentlyWorkingCount,
  onLeaveCount,
  ofisteOlmayanlar,
  dolulukYuzde,
  onFinansClick,
  onRiskClick,
  onMesaiClick,
  onBasariClick,
  onIzinClick, // YENİ EKLENDİ
}) {
  return (
    <Row gutter={[16, 16]}>
      {/* ONAY BEKLEYEN ÖDEMELER */}
      <Col span={6}>
        <Card
          hoverable
          onClick={onFinansClick}
          style={{
            borderTop: "3px solid #faad14",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(250, 173, 20, 0.1)",
            height: "100%",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
          >
            <DollarOutlined
              style={{ fontSize: 24, color: "#faad14", marginRight: 12 }}
            />
            <div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                Onay Bekleyen Ödemeler
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {veri.finans?.map(
                  (fin, idx) =>
                    fin.bekleyenAdet > 0 && (
                      <div
                        key={idx}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: "bold",
                            color: "#faad14",
                          }}
                        >
                          {fin.toplamTutar?.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <Tag
                          color="gold"
                          style={{
                            marginLeft: 4,
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        >
                          {fin.paraBirimi}
                        </Tag>
                      </div>
                    )
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
            <AlertOutlined style={{ marginRight: 4 }} />
            {veri.finans?.bekleyenAdet || 0} adet talep bekliyor
          </div>
          <Progress
            percent={veri.finans?.bekleyenAdet > 0 ? 100 : 0}
            size="small"
            status="active"
            strokeColor="#faad14"
            style={{ marginTop: 8 }}
            showInfo={false}
          />
        </Card>
      </Col>

      {/* ACİL / GECİKEN İŞLER */}
      <Col span={6}>
        <Card
          hoverable
          onClick={onRiskClick}
          style={{
            borderTop: "3px solid #ff4d4f",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(255, 77, 79, 0.1)",
            height: "100%",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
          >
            <AlertOutlined
              style={{ fontSize: 24, color: "#ff4d4f", marginRight: 12 }}
            />
            <div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                Kritik İşler
              </div>
              <div
                style={{ fontSize: 20, fontWeight: "bold", color: "#ff4d4f" }}
              >
                {riskliIslerDetay.length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            {
              riskliIslerDetay.filter((r) => {
                const tarih = dayjs(r.tarih);
                return tarih.isBefore(dayjs(), "day");
              }).length
            }{" "}
            geciken,{" "}
            {
              riskliIslerDetay.filter((r) => {
                const tarih = dayjs(r.tarih);
                const kalan = tarih.diff(dayjs(), "day");
                return kalan <= 3 && kalan >= 0;
              }).length
            }{" "}
            yaklaşan
          </div>
          <Progress
            percent={riskliIslerDetay.length > 0 ? 75 : 0}
            size="small"
            status="active"
            strokeColor="#ff4d4f"
            style={{ marginTop: 8 }}
            showInfo={false}
          />
        </Card>
      </Col>

      {/* OFİS DOLULUK ORANI */}
      <Col span={6}>
        <Card
          hoverable
          onClick={onMesaiClick} // Kartın geneline tıklayınca Mesai Modal açılır
          style={{
            borderTop: "3px solid #722ed1",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(114, 46, 209, 0.1)",
            height: "100%",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
          >
            <FieldTimeOutlined
              style={{ fontSize: 24, color: "#722ed1", marginRight: 12 }}
            />
            <div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                Ofis Doluluğu
              </div>
              <div
                style={{ fontSize: 20, fontWeight: "bold", color: "#722ed1" }}
              >
                {currentlyWorkingCount}/{attendanceData.totalStaff}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            <Space size={8}>
              <Tag color="green" size="small">
                Mesaide: {currentlyWorkingCount}
              </Tag>

              {/* SADECE BU ETİKETE TIKLANINCA İZİN MODALI AÇILIR */}
              <Tooltip title="İzinlileri görmek için tıkla">
                <Tag
                  color="blue"
                  size="small"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation(); // Kartın tıklama olayını durdur
                    onIzinClick();
                  }}
                >
                  İzinde: {onLeaveCount}
                </Tag>
              </Tooltip>

              <Tag color="red" size="small">
                Yok: {ofisteOlmayanlar}
              </Tag>
            </Space>
          </div>
          <Progress
            percent={dolulukYuzde}
            size="small"
            status="active"
            strokeColor="#722ed1"
            style={{ marginTop: 8 }}
            showInfo={false}
          />
        </Card>
      </Col>

      {/* BAŞARI ORANI */}
      <Col span={6}>
        <Card
          hoverable
          onClick={onBasariClick}
          style={{
            borderTop: "3px solid #52c41a",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(82, 196, 26, 0.1)",
            height: "100%",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
          >
            <RiseOutlined
              style={{ fontSize: 24, color: "#52c41a", marginRight: 12 }}
            />
            <div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                Başarı Oranı
              </div>
              <div
                style={{ fontSize: 20, fontWeight: "bold", color: "#52c41a" }}
              >
                {veri.toplamGorev > 0
                  ? Math.round((veri.bitenIsler / veri.toplamGorev) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            <CheckSquareOutlined style={{ marginRight: 4 }} />
            {veri.bitenIsler}/{veri.toplamGorev} tamamlandı
          </div>
          <Progress
            percent={
              veri.toplamGorev > 0
                ? Math.round((veri.bitenIsler / veri.toplamGorev) * 100)
                : 0
            }
            size="small"
            status="active"
            strokeColor="#52c41a"
            style={{ marginTop: 8 }}
            showInfo={false}
          />
        </Card>
      </Col>
    </Row>
  );
}
