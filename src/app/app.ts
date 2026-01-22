import { Component, signal } from '@angular/core';
import { Calendar } from "./components/calendar/calendar";

@Component({
  selector: 'app-root',
  imports: [Calendar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('receta-wells');
}
