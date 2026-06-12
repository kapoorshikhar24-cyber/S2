import customtkinter as ctk
import threading
import time as t

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class T:
    @staticmethod
    def sleep(seconds=3):
        root = ctk.CTk()
        root.title("Timer")
        # Very small geometry
        root.geometry("160x220")
        root.resizable(False, False)
        # Deep dark background
        root.configure(fg_color="#121212")

        total_time = seconds

        # Main frame to hold everything and catch hover events
        main_frame = ctk.CTkFrame(root, fg_color="transparent")
        main_frame.pack(fill="both", expand=True)

        # Canvas for circular progress
        canvas_size = 110
        padding = 6
        canvas = ctk.CTkCanvas(
            main_frame, 
            width=canvas_size, 
            height=canvas_size, 
            bg="#121212", 
            highlightthickness=0
        )
        canvas.pack(pady=(25, 10))

        # Draw background circle
        bg_circle = canvas.create_oval(
            padding, padding, 
            canvas_size - padding, canvas_size - padding, 
            outline="#2A2A2A", 
            width=3
        )

        # Draw progress arc (cyan accent)
        progress_arc = canvas.create_arc(
            padding, padding, 
            canvas_size - padding, canvas_size - padding,
            start=90, 
            extent=-360, 
            style="arc", 
            outline="#00E5FF", 
            width=3
        )

        def format_time(s):
            return f"{s // 60:02d}:{s % 60:02d}"

        # Labels over canvas
        time_label = ctk.CTkLabel(
            main_frame,
            text=format_time(seconds),
            font=("Arial", 28, "normal"),
            text_color="#FFFFFF",
            bg_color="#121212"
        )
        time_label.place(relx=0.5, rely=0.36, anchor="center")

        sub_label = ctk.CTkLabel(
            main_frame,
            text="MIN  :  SEC",
            font=("Arial", 8, "bold"),
            text_color="#888888",
            bg_color="#121212"
        )
        sub_label.place(relx=0.5, rely=0.48, anchor="center")

        # Button Frame
        button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        
        paused = {"value": False}

        def pause():
            paused["value"] = not paused["value"]
            pause_btn.configure(text="▶" if paused["value"] else "II")

        def add_30():
            nonlocal seconds, total_time
            seconds += 30
            total_time += 30
            update_ui()

        def update_ui():
            try:
                time_label.configure(text=format_time(seconds))
                if total_time > 0:
                    fraction = seconds / total_time
                    extent = -360 * fraction
                    canvas.itemconfig(progress_arc, extent=extent)
            except:
                pass

        btn_size = 32
        add_btn = ctk.CTkButton(
            button_frame,
            text="+30",
            command=add_30,
            width=btn_size,
            height=btn_size,
            corner_radius=btn_size,
            fg_color="transparent",
            text_color="#00E5FF",
            border_width=1,
            border_color="#00E5FF",
            font=("Arial", 10, "bold"),
            hover_color="#1A3B40"
        )

        pause_btn = ctk.CTkButton(
            button_frame,
            text="II",
            command=pause,
            width=btn_size,
            height=btn_size,
            corner_radius=btn_size,
            fg_color="#00E5FF",
            text_color="#121212",
            font=("Arial", 12, "bold"),
            hover_color="#00B3CC"
        )

        menu_btn = ctk.CTkButton(
            button_frame,
            text="⋮",
            width=btn_size,
            height=btn_size,
            corner_radius=btn_size,
            fg_color="transparent",
            text_color="#AAAAAA",
            border_width=1,
            border_color="#444444",
            font=("Arial", 14, "bold"),
            hover_color="#222222"
        )

        def show_buttons(event):
            button_frame.place(relx=0.5, rely=0.82, anchor="center")
            add_btn.grid(row=0, column=0, padx=4)
            pause_btn.grid(row=0, column=1, padx=4)
            menu_btn.grid(row=0, column=2, padx=4)

        def hide_buttons(event):
            button_frame.place_forget()

        root.bind("<Enter>", show_buttons)
        root.bind("<Leave>", hide_buttons)

        def countdown():
            nonlocal seconds, total_time
            while seconds > 0:
                if not paused["value"]:
                    update_ui()
                    t.sleep(1)
                    seconds -= 1
            
            try:
                root.after(0, root.destroy)
            except:
                pass

        threading.Thread(target=countdown, daemon=True).start()
        root.mainloop()

if __name__ == "__main__":
    T.sleep(83)
