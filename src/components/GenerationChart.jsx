import { useState } from "react";
import papa from "papaparse";

function parseDateTime(value){
    if(!value) return null;
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    if (!match) return null;
    const [,day,month,year,hour,minute] = match;
    return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
}
function GenerationChart() {
    const [row, setRow] = useState([]);
    const [error, setError] = useState(null);
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if(!file) return;
        setError("");
        setRow([]);
        
        papa.parse(file, {
            header: true,
            skipEmptyLines: true,

            complete: (result) => {
            const headers = result.meta.fields || [];

            if (
                !headers.includes("DATE_TIME") ||
                !headers.includes("AC_POWER")
            ) {
                setError("CSV must contain DATE_TIME and AC_POWER columns.");
                return;
            }
            
            const parsedRows = result.data
                .map((row) =>{
                    const date = parseDateTime(row.DATE_TIME);
                    const power = Number(row.AC_POWER);

                    if(!date ||row.AC_POWER === "" || !Number.isFinite(power)  ) {
                        return null;
                    }
                    return {
                        date,power,timestamp: date.getTime(),
                    };
                })
                .filter(Boolean);
                if(parsedRows.length===0){
                    setError("No valid power readings were found.");
                    return;
                }
        
                const grouped = new Map();
                for (const row of parsedRows) {
                if (!grouped.has(row.timestamp)) {
                    grouped.set(row.timestamp, {
                        date: row.date,
                        power: 0,
                    });
                    }

                    grouped.get(row.timestamp).power+=row.power;
                }
                const plantRows = Array.from(grouped.values()).sort(
                    (a,b)=> a.date-b.date
                );
                setRow(plantRows);

                console.log("Plant readings:", plantRows);
                console.log("Number of timestamps:", plantRows.length);
            },
            error:()=>{
                setError("Could not read the CSV file.");
            },
        });
    };
    return (
        <div className="chart-container">
            <h3>Today's Generation</h3>
            <label className="csv-upload">
            Upload generation CSV
            <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                const file = event.target.files[0];
                    if (file) {
                        console.log("Selected file:", file.name);
                    }
                }}
            />
            </label>
            {error && <p className="chart-error">{error}</p>}

        </div>
    );
}

export default GenerationChart;