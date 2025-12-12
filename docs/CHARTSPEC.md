Spezifikation für die Chart-Page:

Die ChartPage.tsx besteht aus zwei Bereichen oben und unten.
Im oberen Bereich soll eine Chart-View basierend auf echarts
 (https://echarts.apache.org/examples/en/index.html)
oder echarts-for-react (https://github.com/hustcc/echarts-for-react) sein.

Im unteren bereich soll eine Tabelle mit den verschiedenen basis datensätzen angezeigt werden.
Die datenquelle der tabelle sind die markets daten aus dem lokalen verzeichnis 
A:/DATA/polymarket/markets
Die Marketdaten sind strukturiert nach symbol und datum.
Das datum ist das datum des markets in format yyyy-mm-dd.
Das symbol ist das symbol des markets.
Die Marketdaten sind in json format.
Die Marketdaten sind in der folgenden struktur:
{
	"slug": "string",
	"openPrice": number,
	"closePrice": number,
	"openPriceTimestamp": number,
	"closePriceTimestamp": number,
}

Die Tabelle soll die folgenden spalten haben:
- Symbol
- Datum
- Open Price
- Close Price
- Open Price Timestamp
- Close Price Timestamp

Die Tabelle soll sortierbar sein.
Die Tabelle soll filtern.
Die Tabelle soll paginierbar sein.

Im Header der Tabelle soll eine Button-Bar mit den Auswählbaren Symbolen sein:
- BTC
- ETH
- SOL
- XRP
Und ein Button für die Auswahl des Datums.
Es sollen nur Datumfelder der vorhandenen Markt-Daten angezeigt werden. Maximal 30 Tage.
Es sollen nur die Markt-Daten für das ausgewählte Symbol und das ausgewählte Datum angezeigt werden.

Die Chat-View im oberen Bereich soll eine Chart-View basierend auf echarts
oder echarts-for-react sein.
Die Chart-View soll für den Anfang nur Linien-Charts anzeigen.

Die Markdaten bestehen aus 