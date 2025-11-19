#!/usr/bin/env python3
"""
Standalone script to run the live graph visualization.
This can be run independently while synthetic_sensors.py is running.
Saves the graph as a PNG image for web display.
"""

import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import the live graph function from the notebook
# Since we can't directly import from notebook, we'll define it here
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from datetime import datetime
import time

# Path to sensor data file (created by synthetic_sensors.py)
SENSOR_DATA_FILE = Path(__file__).parent / "sensor_live_data.csv"
GRAPH_IMAGE_FILE = Path(__file__).parent / "live_graph.png"

def create_live_graph(max_points=50, update_interval=1000):
    """
    Create a live updating graph from synthetic sensor data.
    
    Parameters:
    - max_points: Maximum number of data points to display (default: 50)
    - update_interval: Animation update interval in milliseconds (default: 1000ms)
    """
    # Initialize data storage
    timestamps = []
    readings_data = {
        'Temp': [],
        'DO': [],
        'pH': [],
        'Risk_Score': []  # Numeric risk: 0=Low, 1=Medium, 2=High
    }
    risk_labels = []
    
    # Risk to numeric mapping
    risk_to_num = {'Low': 0, 'Medium': 1, 'High': 2}
    
    # Create figure with subplots
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('Live Water Quality Monitoring - Synthetic Sensor Data', fontsize=16, fontweight='bold')
    
    # Subplot 1: Temperature
    ax1 = axes[0, 0]
    line1, = ax1.plot([], [], 'b-', linewidth=2, marker='o', markersize=4)
    ax1.set_title('Temperature (°C)', fontweight='bold')
    ax1.set_ylabel('Temperature (°C)')
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim(15, 40)
    
    # Subplot 2: Dissolved Oxygen
    ax2 = axes[0, 1]
    line2, = ax2.plot([], [], 'g-', linewidth=2, marker='s', markersize=4)
    ax2.set_title('Dissolved Oxygen (mg/L)', fontweight='bold')
    ax2.set_ylabel('DO (mg/L)')
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(0, 12)
    
    # Subplot 3: pH Level
    ax3 = axes[1, 0]
    line3, = ax3.plot([], [], 'r-', linewidth=2, marker='^', markersize=4)
    ax3.set_title('pH Level', fontweight='bold')
    ax3.set_ylabel('pH')
    ax3.set_xlabel('Time')
    ax3.grid(True, alpha=0.3)
    ax3.set_ylim(5, 10)
    ax3.axhspan(6.5, 8.5, alpha=0.2, color='green', label='Safe Range')
    
    # Subplot 4: Risk Level
    ax4 = axes[1, 1]
    line4, = ax4.plot([], [], 'purple', linewidth=2, marker='D', markersize=4)
    ax4.set_title('Predicted Risk Level', fontweight='bold')
    ax4.set_ylabel('Risk (0=Low, 1=Medium, 2=High)')
    ax4.set_xlabel('Time')
    ax4.grid(True, alpha=0.3)
    ax4.set_ylim(-0.5, 2.5)
    ax4.set_yticks([0, 1, 2])
    ax4.set_yticklabels(['Low', 'Medium', 'High'])
    ax4.axhspan(0, 0.5, alpha=0.2, color='green', label='Low Risk')
    ax4.axhspan(0.5, 1.5, alpha=0.2, color='yellow', label='Medium Risk')
    ax4.axhspan(1.5, 2.5, alpha=0.2, color='red', label='High Risk')
    
    plt.tight_layout()
    
    def read_sensor_data():
        """Read latest data from sensor CSV file"""
        if not SENSOR_DATA_FILE.exists():
            return None
        
        try:
            # Read the CSV file
            df = pd.read_csv(SENSOR_DATA_FILE)
            if len(df) == 0:
                return None
            
            # Get the latest row
            latest = df.iloc[-1]
            
            # Parse timestamp
            try:
                ts = pd.to_datetime(latest['timestamp'])
            except:
                ts = datetime.now()
            
            return {
                'timestamp': ts,
                'Temp': latest.get('Temp', np.nan),
                'DO': latest.get('DO', np.nan),
                'pH': latest.get('pH', np.nan),
                'Risk': latest.get('Risk', 'Unknown')
            }
        except Exception as e:
            print(f"Error reading sensor data: {e}")
            return None
    
    def update_graph():
        """Update graph with latest data"""
        # Read latest sensor data
        data = read_sensor_data()
        
        if data is None:
            # Still save the current state even if no new data
            try:
                fig.savefig(GRAPH_IMAGE_FILE, dpi=100, bbox_inches='tight', facecolor='white')
            except:
                pass
            return
        
        # Check if this is a new data point (avoid duplicates)
        if len(timestamps) > 0 and timestamps[-1] == data['timestamp']:
            # Same timestamp, just update the existing graph
            pass
        else:
            # Add new data point
            timestamps.append(data['timestamp'])
            readings_data['Temp'].append(data['Temp'])
            readings_data['DO'].append(data['DO'])
            readings_data['pH'].append(data['pH'])
            
            # Convert risk to numeric
            risk_num = risk_to_num.get(data['Risk'], 1)
            readings_data['Risk_Score'].append(risk_num)
            risk_labels.append(data['Risk'])
        
        # Keep only last max_points
        if len(timestamps) > max_points:
            timestamps.pop(0)
            readings_data['Temp'].pop(0)
            readings_data['DO'].pop(0)
            readings_data['pH'].pop(0)
            readings_data['Risk_Score'].pop(0)
            risk_labels.pop(0)
        
        # Update plots
        if len(timestamps) > 0:
            # Convert timestamps to relative time (seconds from start)
            if len(timestamps) == 1:
                time_axis = [0]
            else:
                start_time = timestamps[0]
                time_axis = [(t - start_time).total_seconds() for t in timestamps]
            
            line1.set_data(time_axis, readings_data['Temp'])
            line2.set_data(time_axis, readings_data['DO'])
            line3.set_data(time_axis, readings_data['pH'])
            line4.set_data(time_axis, readings_data['Risk_Score'])
            
            # Update axis limits
            if len(time_axis) > 1:
                ax1.set_xlim(min(time_axis), max(time_axis))
                ax2.set_xlim(min(time_axis), max(time_axis))
                ax3.set_xlim(min(time_axis), max(time_axis))
                ax4.set_xlim(min(time_axis), max(time_axis))
            else:
                ax1.set_xlim(0, 10)
                ax2.set_xlim(0, 10)
                ax3.set_xlim(0, 10)
                ax4.set_xlim(0, 10)
        
        # Save the graph as PNG image
        try:
            fig.savefig(GRAPH_IMAGE_FILE, dpi=100, bbox_inches='tight', facecolor='white')
        except Exception as e:
            print(f"Error saving graph image: {e}")
    
    print("📊 Live graph started. Make sure synthetic_sensors.py is running.")
    print(f"   Reading from: {SENSOR_DATA_FILE.absolute()}")
    print(f"   Saving graph to: {GRAPH_IMAGE_FILE.absolute()}")
    print("   Graph will update every", update_interval, "ms")
    print("   Press Ctrl+C to stop.")
    
    # Save initial empty graph
    try:
        fig.savefig(GRAPH_IMAGE_FILE, dpi=100, bbox_inches='tight', facecolor='white')
    except Exception as e:
        print(f"Error saving initial graph: {e}")
    
    # Run the update loop manually (no animation framework needed)
    try:
        while True:
            update_graph()
            time.sleep(update_interval / 1000.0)
    except KeyboardInterrupt:
        print("\n🛑 Stopping live graph...")
        plt.close(fig)
    except Exception as e:
        print(f"Error in graph loop: {e}")
        import traceback
        traceback.print_exc()
        plt.close(fig)
    
    return None

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Live graph visualization for synthetic sensor data')
    parser.add_argument('--max-points', type=int, default=50, help='Maximum data points to display')
    parser.add_argument('--update-interval', type=int, default=1000, help='Update interval in milliseconds')
    args = parser.parse_args()
    
    create_live_graph(max_points=args.max_points, update_interval=args.update_interval)

