'strict mode';

class TaskManager {
	// Private variables
	#title = document.getElementById('taskTitle');
	#description = document.getElementById('taskDescription');
	#dueDate = document.getElementById('taskDueDate');
	#priority = document.getElementById('taskPriority');
	#calendar = document.getElementById('calendar');
	#toggleCalendar = document.getElementById('toggleCalendar');

	constructor() {
		// Load/Access tasks from localStorage
		this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
		console.log(this.tasks);

		// accsessing the taskForm and Lists in the HTML
		this.taskForm = document.getElementById('taskForm');
		this.taskList = document.getElementById('taskList');

		// Track task being edited
		this.editingTaskId = null;

		// render all filters
		this.currentFilter = 'all';
		this._bindFilterEvents();

		// sorted filters
		this.currentSort = 'priority'; // default sort
		this._bindSortingEvents();

		// initialize bindEvents and the render tasks
		this._bindEvents();
		this._renderTasks();

		// initiate calender
		this._initCalendar();

		// Check overdue tasks
		this._checkOverdueTasks();

		// Requesting Notification permission (Browsers Notifications API)
		if (Notification.permission !== 'granted') {
			Notification.requestPermission();
		}

		// Run checks periodically (every hour)
		setInterval(() => {
			this._checkOverdueTasks();
			this._checkDueSoonTasks();
		}, 3600000);
	}

	_bindEvents() {
		this.taskForm.addEventListener('submit', e => this._handleAddTask(e));
		this.taskList.addEventListener('click', e =>
			this._handleTaskActions(e)
		);
		this.taskList.addEventListener('change', e =>
			this._handleToggleComplete(e)
		);
	}

	_bindFilterEvents() {
		document.querySelector('.filters').addEventListener('click', e => {
			const filterBtn = e.target.closest('.filter-btn');

			if (filterBtn) {
				// ***Update active filter button
				document
					.querySelectorAll('.filter-btn')
					.forEach(btn => btn.classList.remove('active'));

				filterBtn.classList.add('active');

				// Set the filter and re-render it
				this.currentFilter = filterBtn.dataset.filter;
				this._renderTasks();
			}
		});
	}

	// Sorted based on completed, pending or all
	_bindSortingEvents() {
		document.getElementById('sortBy').addEventListener('change', e => {
			this.currentSort = e.target.value;
			this._renderTasks();
		});
	}

	// Sorts based on priority or due dates
	_sortTasks(tasks) {
		return tasks.sort((a, b) => {
			// first sort by selected criteria
			const primarySort = this._compareByCriteria(a, b, this.currentSort);

			// if primary criteria are equal, sort by secondary criteria
			if (primarySort === 0) {
				const secondaryCriteria =
					this.currentSort === 'priority' ? 'dueDate' : 'priority';
				return this._compareByCriteria(a, b, secondaryCriteria);
			}

			return primarySort;
		});
	}

	_compareByCriteria(a, b, criteria) {
		if (criteria === 'priority') {
			const priorityOrder = { high: 3, medium: 2, low: 1 };
			return priorityOrder[b.priority] - priorityOrder[a.priority];
		}

		// Sort by due date (earliest first)
		if (criteria === 'dueDate') {
			return new Date(a.dueDate) - new Date(b.dueDate);
		}

		return 0;
	}

	_handleEventDrop(info) {
		const taskId = info.event.extendedProps.taskId;
		const newDueDate = info.event.startStr.split('T')[0];
		const task = this.tasks.find(t => t.id === taskId);

		if (task) {
			task.dueDate = newDueDate;
			this._saveTasks();
			this._renderTasks();
		}
	}

	_checkOverdueTasks() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		this.tasks.forEach(task => {
			const dueDate = new Date(task.dueDate);
			if (dueDate < today && !task.completed) {
				alert(`🚨 Task "${task.title}" is overdue!`);
			}
		});
	}

	_checkDueSoonTasks() {
		const today = new Date();
		const tomorrow = new Date();
		tomorrow.setDate(today.getDate() + 1);

		this.tasks.forEach(task => {
			const dueDate = new Date(task.dueDate);
			if (dueDate > today && dueDate <= tomorrow && !task.completed) {
				this._showNotification(
					`⏰ Task "${task.title}" is due tomorrow!`
				);
			}
		});
	}

	_showNotification(message) {
		if (Notification.permission === 'granted') {
			new Notification(message);
		}
	}

	// initiating the Full Calendar API
	_initCalendar() {
		const calendarEl = this.#calendar;
		(this.calendar = new FullCalendar.Calendar(calendarEl, {
			initialView: 'dayGridMonth',
			editable: true,
			droppable: true,
			events: this.tasks.map(task => ({
				title: task.title,
				start: task.dueDate,
				color: this._getPriorityColor(task.priority),
				extendedProps: { taskId: task.id },
			})),
			eventDrop: info => this._handleEventDrop(info),
			drop: info => {
				const taskId = info.dataTransfer.getData('text/plain');
				const newDuedate = info.dateStr.split('T')[0];
				const task = this.tasks.find(t => t.id === taskId);
				if (task) {
					task.dueDate = newDuedate;
					this._saveTasks();
					this._renderTasks();
					this.calendar.refetchEvents();
				}
			},
			eventClick: info => {
				const taskId = info.event.extendedProps.taskId;
				const task = this.tasks.find(task => task.id === taskId);
				this._populateFormForEdit(task);
			},
		})),
			this.calendar.render();

		// Toggle calendar view
		this.#toggleCalendar.addEventListener('click', () => {
			const calendarVisible = calendarEl.style.display === 'none';
			calendarEl.style.display = calendarVisible ? 'block' : 'none';
			this.taskList.style.display = calendarVisible ? 'none' : 'block';
			if (calendarVisible) this.calendar.render();
		});
	}

	_getPriorityColor(priority) {
		const colors = { low: '#28a745', medium: '#ffc107', high: '#dc3545' };
		return colors[priority] || '#6c757d';
	}

	// Unique ID
	_generateId() {
		return crypto.randomUUID().slice(0, 8);
	}

	// Add tasks
	_handleAddTask(e) {
		e.preventDefault();
		const title = this.#title.value;
		const description = this.#description.value;
		const dueDateInput = this.#dueDate.value;
		const priority = this.#priority.value;

		const dueDate = new Date(dueDateInput);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// validate date
		if (dueDate < today) {
			alert('Due dates cannot be in the past');
			return;
		}

		if (this.editingTaskId) {
			// Update existing task
			const task = this.tasks.find(
				task => task.id === this.editingTaskId
			);
			task.title = title;
			task.description = description;
			task.dueDate = dueDate;
			task.priority = priority;

			// Reset editing state
			this.editingTaskId = null;
		} else {
			const newTask = {
				id: this._generateId(),
				title,
				description,
				dueDate,
				priority,
				completed: false,
			};
			this.tasks.push(newTask);
		}

		this.calendar.refetchEvents();
		this._saveTasks();
		this._renderTasks();
		this.taskForm.reset();
	}

	// Handling delete and edits
	_handleTaskActions(e) {
		const deleteBtn = e.target.closest('.delete-btn');
		const editBtn = e.target.closest('.edit-btn');

		// delete button
		if (deleteBtn) {
			const taskId = deleteBtn.dataset.id;
			this.tasks = this.tasks.filter(task => task.id !== taskId);

			this.calendar.refetchEvents();
			this._saveTasks();
			this._renderTasks();
		}

		// edit button
		if (editBtn) {
			const taskId = editBtn.dataset.id;
			const task = this.tasks.find(task => task.id === taskId);
			this.editingTaskId = taskId;

			this.calendar.refetchEvents();
			this._populateFormForEdit(task);
		}
	}

	// Populate form for edits
	_populateFormForEdit(task) {
		this.#title.value = task.title;
		this.#description.value = task.description;
		this.#dueDate.value = task.dueDate;

		// store task ID being edited
		this.taskForm.dataset.editingTaskId = task.id;
	}

	_getPriorityLabel(priority) {
		const labels = {
			low: 'Low',
			medium: 'Medium',
			high: 'High',
		};
		return labels[priority] || 'Low'; // fallback to 'low if undefined
	}

	// toggling completed task
	_handleToggleComplete(e) {
		const checkbox = e.target.closest('.complete-checkbox');
		if (checkbox) {
			const taskId = checkbox.dataset.id;
			const task = this.tasks.find(task => task.id === taskId);
			// toggle property
			task.completed = !task.completed;
			this._saveTasks();
			this._renderTasks();
		}
	}

	// Save tasks
	_saveTasks() {
		localStorage.setItem('tasks', JSON.stringify(this.tasks));
	}

	// Render tasks dynamically
	_renderTasks() {
		// Render based on currentFilter
		const filteredTasks = this.tasks.filter(task => {
			// completed tasks
			if (this.currentFilter === 'completed') return task.completed;
			// Pending tasks
			if (this.currentFilter === 'pending') return !task.completed;
			// return all tasks
			return true;
		});

		// sort tasks
		const sortedTasks = this._sortTasks(filteredTasks);

		this.taskList.innerHTML = sortedTasks
			.map(task => {
				const dueDate = new Date(task.duedate);
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				let statusClass = '';
				if (dueDate < today && !task.completed) statusClass = 'overdue';
				else if (dueDate.getDate() === today.getDate() + 1)
					statusClass = 'due-soon';

				return `<div class="task ${
					task.completed ? 'completed' : ''
				} ${statusClass}" data-priority="${
					task.priority
				}" draggable="true">
						<div>
						<input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${
					task.id
				}" class="complete-checkbox">
					<div class="priority-indicator ${task.priority}">
					</div>
					<div class="priority-tag ${task.priority}">${this._getPriorityLabel(
					task.priority
				)}</div>
							<h3>${task.title}</h3>
							<p>${task.description}</p>
							<p>Due: <span>${task.dueDate}</span></p>
						</div>

						<div>
							<button class="edit-btn" data-id="${task.id}">Edit</button>
							<button class="delete-btn" data-id="${task.id}">Delete</button>
						</div>
					</div>`;
			})
			.join('');

		// Re-bind dragstart event after rendering
		this.taskList.querySelectorAll('.task').forEach(taskElement => {
			taskElement.addEventListener('dragstart', e => {
				// Auto-show calendar when dragging starts
				if (this.#calendar.style.display === 'none') {
					this.#toggleCalendar.click();
				}
				e.dataTransfer.setData('text/plain', taskElement.dataset.id);
			});
		});
	}
}

// initialize app
const taskManager = new TaskManager();
