document.addEventListener('DOMContentLoaded', function () {
    let licenseMapping = {};
    let currentEventId = null;
    let currentEventName = null;
    let currentEventDate = null;
    let organization = '';  // Переменная для хранения организации
    let otherOrganization = '';  // Переменная для хранения другой организации

    fetch('/files')
        .then(response => response.json())
        .then(data => {
            const startlistsContainer = document.getElementById('startlists');
            const competitionsContainer = document.getElementById('competitions-files');
			
			const ignoredFolders = ['.cl.selector', '.cagefs'];
			const upcomingEvents = [];
			const pastEvents = [];
		
            let cachedUTCDate = null;
			let lastFetchTime = null;
			const fetchInterval = 10 * 60 * 1000; // 10 минут в миллисекундах

			function getLocalTime() {
				return new Date();
			}

			// Функция для получения реального UTC времени через серверный маршрут
			function getRealUTC() {
				return fetch('/server-time')
					.then(response => response.json())
					.then(data => new Date(data.utcTime))
					.catch(error => {
						console.error('Error fetching current UTC time from server:', error);
						return getLocalTime(); // В случае ошибки возвращаем локальное время
					});
			}

			// Функция для проверки корректности времени устройства
			function validateUserTime() {
				return getRealUTC().then(realUTC => {
					const userTime = getLocalTime();
					const timeDifference = Math.abs(userTime - realUTC);
					const tolerance = 60 * 1000; // Допустимое отклонение 1 минута

					if (timeDifference > tolerance) {
						console.warn('Время на устройстве пользователя некорректно. Используем реальное UTC время.');
						return realUTC;
					} else {
						return userTime;
					}
				});
			}

			// Функция для получения текущего времени (сначала пробуем с устройства, потом проверяем и при необходимости обновляем)
			function fetchCurrentUTC() {
				if (cachedUTCDate && (performance.now() - lastFetchTime < fetchInterval)) {
					return Promise.resolve(cachedUTCDate);
				} else {
					return validateUserTime().then(utcDate => {
						cachedUTCDate = utcDate;
						lastFetchTime = performance.now();
						return cachedUTCDate;
					});
				}
			}

			data.forEach(entry => {
                const trimmedEntry = entry.trim();
                if (trimmedEntry) {
                    const parts = trimmedEntry.split('___');
                    if (parts.length === 3) {
                        const [eventNumber, date, eventName] = parts;
                        const event = { date, name: eventName, id: eventNumber };
                        const eventDate = parseEventDate(date);
                        if (eventDate >= new Date()) {
                            upcomingEvents.push(event);
                        } else {
                            pastEvents.push(event);
                        }
                    } else {
                        console.warn('Invalid entry format:', trimmedEntry);
                    }
                }
            });
            
            function checkFileExists(url) {
                return fetch(url, { method: 'HEAD' })
                    .then(response => response.ok)
                    .catch(() => false);
            }

            function createUpcomingEventListItem(event, container) {
                const cardDiv = document.createElement('div');
                cardDiv.classList.add('card', 'mb-3');
                cardDiv.style.borderColor = '#2d8401';
            
                const cardBodyDiv = document.createElement('div');
                cardBodyDiv.classList.add('card-body');
                cardBodyDiv.style.padding = '0.9rem';
            
                const h5Title = document.createElement('h5');
                h5Title.classList.add('card-title');
                h5Title.textContent = event.name;
            
                const h6Subtitle = document.createElement('h6');
                h6Subtitle.classList.add('card-subtitle', 'mb-2', 'text-muted');
                h6Subtitle.textContent = event.date;
            
                cardBodyDiv.appendChild(h5Title);
                cardBodyDiv.appendChild(h6Subtitle);
                cardBodyDiv.appendChild(document.createElement('hr'));
            
                const configPath = `../entrySys/${encodeURIComponent(event.id)}___${encodeURIComponent(event.date)}___${encodeURIComponent(event.name)}/config.json`;
                fetch(configPath)
                    .then(response => response.json())
                    .then(config => {
                        fetchCurrentUTC().then(currentDate => {
                            const registrationStartDate = new Date(config.registrationStartDate);
                            const registrationEndDate = new Date(config.registrationEndDate);
                            const statusIndicator = document.createElement('span');
                            statusIndicator.classList.add('status-indicator');
            
                            const registrationInfo = document.createElement('p');
                            registrationInfo.style.fontSize = 'small';
                            registrationInfo.classList.add('card-text');
            
                            let registrationStatus;
                            let borderColor = '#2d8401';
            
                            if (currentDate < registrationStartDate) {
                                registrationStatus = 'pieteikšanās nav sākušas';
                                borderColor = '#ffc107';
                            } else if (currentDate > registrationEndDate) {
                                registrationStatus = 'pieteikšanās ir slēgtas';
                                borderColor = '#dc3545';
                            } else {
                                registrationStatus = 'pieteikšanās aktīvas';
                            }
            
                            statusIndicator.style.backgroundColor = borderColor;
                            registrationInfo.innerHTML = `${statusIndicator.outerHTML} ${registrationStatus}<br>`;
                            cardBodyDiv.appendChild(registrationInfo);
                            cardBodyDiv.appendChild(document.createElement('hr'));
            
                            const registrationTerm = document.createElement('div');
                            registrationTerm.innerHTML = `
                                <i class="far fa-edit"></i>
                                <span style="font-size: small;">pieteikšanās termiņš: </span>
                                <span style="font-weight: bold; font-size: small;">${registrationStartDate.toLocaleDateString()} | ${registrationEndDate.toLocaleDateString()}</span>
                            `;
                            cardBodyDiv.appendChild(registrationTerm);
            
                            const btnGroupDiv = document.createElement('div');
                            btnGroupDiv.classList.add('btn-group', 'btn-group-sm');
                            btnGroupDiv.setAttribute('role', 'group');
            
                            if (registrationStatus === 'pieteikšanās aktīvas') {
                                const registerBtn = document.createElement('a');
                                registerBtn.classList.add('btn', 'btn-secondary');
                                registerBtn.href = '#';
                                registerBtn.textContent = 'pieteikties';
                                registerBtn.setAttribute('data-id', event.id);
                                registerBtn.setAttribute('data-event', event.name);
                                registerBtn.setAttribute('data-date', event.date);
                                btnGroupDiv.appendChild(registerBtn);
            
                                registerBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    const eventId = e.target.getAttribute('data-id');
                                    const eventName = e.target.getAttribute('data-event');
                                    const eventDate = e.target.getAttribute('data-date');
                                    if (eventName && eventDate) {
                                        fetchAndDisplayRegistrationForm(eventId, eventName, eventDate);
                                    } else {
                                        console.error('Missing eventName or eventDate');
                                    }
                                });
                            } if(registrationStatus === 'pieteikšanās ir slēgtas') {
                                const resultBtn = document.createElement('a');
                                resultBtn.classList.add('btn', 'btn-secondary');
                                resultBtn.href = `https://sportdss.eu/details/?event=${encodeURIComponent(event.name)}&date=${encodeURIComponent(event.date)}&id=${event.id}`;
                                resultBtn.textContent = 'starta un finiša protokoli';
                                btnGroupDiv.appendChild(resultBtn);
                            }
            
                            const entryListBtn = document.createElement('a');
                            entryListBtn.classList.add('btn', 'btn-secondary');
                            entryListBtn.href = `https://sportdss.eu/entrylist/?event=${encodeURIComponent(event.name)}&date=${encodeURIComponent(event.date)}&id=${encodeURIComponent(event.id)}`;
                            entryListBtn.textContent = 'dalībnieku saraksts';
                            btnGroupDiv.appendChild(entryListBtn);
            
                            cardBodyDiv.appendChild(document.createElement('hr'));
                            cardBodyDiv.appendChild(btnGroupDiv);
                            cardDiv.style.borderColor = borderColor;
                            cardDiv.appendChild(cardBodyDiv);
                            container.appendChild(cardDiv);
                        });
                    })
                    .catch(error => {
                        console.warn('Config file not found or error fetching config:', error);
                        container.appendChild(cardDiv);
                    });
            }      

			function createPastEventListItem(event, container) {
                const cardDiv = document.createElement('div');
                cardDiv.classList.add('card');
                cardDiv.style.marginBottom = '10px';
            
                const cardBodyDiv = document.createElement('div');
                cardBodyDiv.classList.add('card-body');
                cardBodyDiv.style.padding = '0.9rem';
            
                const h6Title = document.createElement('h6');
                h6Title.classList.add('card-title');
                h6Title.textContent = event.name;
            
                const h6Subtitle = document.createElement('h6');
                h6Subtitle.classList.add('card-subtitle', 'mb-2', 'text-muted');
                h6Subtitle.style.fontSize = 'small';
                h6Subtitle.textContent = event.date;
            
                const btnGroupDiv = document.createElement('div');
                btnGroupDiv.classList.add('btn-group', 'btn-group-sm');
                btnGroupDiv.setAttribute('role', 'group');
            
                const resultBtn = document.createElement('a');
                resultBtn.classList.add('btn', 'btn-secondary');
                resultBtn.href = `https://sportdss.eu/details/?event=${encodeURIComponent(event.name)}&date=${encodeURIComponent(event.date)}&id=${encodeURIComponent(event.id)}`;
                resultBtn.textContent = 'starta un finiša protokoli';
            
                btnGroupDiv.appendChild(resultBtn);
            
                const entriesCsvPath = `../entrySys/${encodeURIComponent(event.id)}___${encodeURIComponent(event.date)}___${encodeURIComponent(event.name)}/entries.csv`;
            
                checkFileExists(entriesCsvPath).then(fileExists => {
                    if (fileExists) {
                        const entryListBtn = document.createElement('a');
                        entryListBtn.classList.add('btn', 'btn-secondary');
                        entryListBtn.href = `https://sportdss.eu/entrylist/?event=${encodeURIComponent(event.name)}&date=${encodeURIComponent(event.date)}&id=${encodeURIComponent(event.id)}`;
                        entryListBtn.textContent = 'dalībnieku saraksts';
                        btnGroupDiv.appendChild(entryListBtn);
                    }
            
                    cardBodyDiv.appendChild(h6Title);
                    cardBodyDiv.appendChild(h6Subtitle);
                    cardBodyDiv.appendChild(btnGroupDiv);
                    cardDiv.appendChild(cardBodyDiv);
                    container.appendChild(cardDiv);
            
                    fetch(`../entrySys/${encodeURIComponent(event.id)}___${encodeURIComponent(event.date)}___${encodeURIComponent(event.name)}/config.json`)
                        .then(response => response.json())
                        .then(config => {
                            fetchCurrentUTC().then(currentDate => {
                                const registrationStartDate = new Date(config.registrationStartDate);
                                const registrationEndDate = new Date(config.registrationEndDate);
            
                                if (currentDate >= registrationStartDate && currentDate <= registrationEndDate) {
                                    cardDiv.style.borderColor = '#2d8401';
            
                                    const registerBtn = document.createElement('a');
                                    registerBtn.classList.add('btn', 'btn-secondary');
                                    registerBtn.href = '#';
                                    registerBtn.textContent = 'pieteikties';
                                    registerBtn.setAttribute('data-event', eventName);
                                    registerBtn.setAttribute('data-date', eventDate);
                                    btnGroupDiv.appendChild(registerBtn);
            
                                    registerBtn.addEventListener('click', function (e) {
                                        e.preventDefault();
                                        const eventId = e.target.getAttribute('data-id');
                                        const eventName = e.target.getAttribute('data-event');
                                        const eventDate = e.target.getAttribute('data-date');
                                        if (eventName && eventDate) {
                                            fetchAndDisplayRegistrationForm(eventId, eventName, eventDate);
                                        } else {
                                            console.error('Missing eventName or eventDate');
                                        }
                                    });
            
                                    const registrationTerm = document.createElement('div');
                                    registrationTerm.innerHTML = `
                                        <i class="far fa-edit"></i>
                                        <span style="font-size: small;">pieteikšanās termiņš: </span>
                                        <span style="font-weight: bold; font-size: small;">${registrationStartDate.toLocaleDateString()} | ${registrationEndDate.toLocaleDateString()}</span>
                                    `;
                                    cardBodyDiv.appendChild(registrationTerm);
                                }
                            });
                        })
                        .catch(error => console.warn('Error fetching past event config:', error));
                });
            }

			// Основная функция, которая вызывает соответствующую функцию для каждого мероприятия
			function createEventListItem(event, container, isPastEvent) {
				if (isPastEvent) {
					createPastEventListItem(event, container);
				} else {
					createUpcomingEventListItem(event, container);
				}
			}

			function parseEventDate(eventString) {
                if (!eventString || typeof eventString !== 'string') {
                    console.error('Invalid event string:', eventString);
                    return new Date(0);
                }
            
                const [day, month, year] = eventString.split('-').map(Number);
                if (isNaN(day) || isNaN(month) || isNaN(year)) {
                    console.error('Invalid date components:', day, month, year);
                    return new Date(0);
                }
            
                return new Date(year, month - 1, day);
            }
            
            upcomingEvents.sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date));
            pastEvents.sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date));
            
            upcomingEvents.forEach(event => createEventListItem(event, startlistsContainer, false));
            pastEvents.forEach(event => createEventListItem(event, competitionsContainer, true));
            
            
            let boatClasses = [];

            function fetchAndDisplayRegistrationForm(eventId, eventName, eventDate) {
                const dialogTitle = document.getElementById('dialog-title');
                if (dialogTitle) {
                    dialogTitle.textContent = `${eventName} - ${eventDate}`;
                } else {
                    console.error('Element with id "dialog-title" not found');
                    return;
                }
            
                fetch(`../entrySys/${encodeURIComponent(eventId)}___${encodeURIComponent(eventDate)}___${encodeURIComponent(eventName)}/config.json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Form not found');
                        }
                        return response.json();
                    })
                    .then(config => {
                        organization = config.organization || '';
                        otherOrganization = config.otherOrganization || '';
                        boatClasses = config.boatClasses;
            
                        const formHtml = generateFormHtml(config, eventName, eventDate);
                        const entryForm = document.getElementById('entryForm');
                        if (entryForm) {
                            entryForm.innerHTML = formHtml;
                        } else {
                            console.error('Element with id "entryForm" not found');
                            return;
                        }
            
                        const organizationSelect = document.getElementById('organization');
                        if (organizationSelect) {
                            organizationSelect.innerHTML = '';
                            if (config.organizations && config.organizations.length > 0) {
                                config.organizations.forEach(org => {
                                    const option = document.createElement('option');
                                    option.value = org;
                                    option.textContent = org;
                                    organizationSelect.appendChild(option);
                                });
                            } else {
                                const option = document.createElement('option');
                                option.value = 'Other';
                                option.textContent = 'Other';
                                organizationSelect.appendChild(option);
                            }
                        }
            
                        const otherOrganizationInput = document.getElementById('other-organization');
                        if (organizationSelect) {
                            organizationSelect.addEventListener('change', function () {
                                if (otherOrganizationInput) {
                                    otherOrganizationInput.style.display = (this.value === 'Other') ? 'block' : 'none';
                                }
                            });
                        }
            
                        const boatClassSelect = document.getElementById('boat-class');
                        if (boatClassSelect) {
                            boatClassSelect.innerHTML = '';
                            boatClasses.forEach(boatClass => {
                                const option = document.createElement('option');
                                option.value = boatClass.class;
                                option.textContent = boatClass.class;
                                boatClassSelect.appendChild(option);
                            });
                            boatClassSelect.addEventListener('change', function() {
                                handleBoatClassChange(eventId, eventName, eventDate);
                            });
                        }
            
                        const licenseCheckbox = document.getElementById('has-license');
                        if (licenseCheckbox) {
                            licenseCheckbox.addEventListener('change', function() {
                                handleBoatClassChange(eventId, eventName, eventDate);
                            });
                        }
            
                        const crewCheckbox = document.getElementById('joined-crew');
                        if (crewCheckbox) {
                            crewCheckbox.addEventListener('change', function() {
                                handleBoatClassChange(eventId, eventName, eventDate);
                            });
                        }
            
                        handleBoatClassChange(eventId, eventName, eventDate);
            
                        const registrationForm = document.getElementById('registration-form');
                        if (registrationForm) {
                            registrationForm.addEventListener('submit', function (event) {
                                event.preventDefault();
                                const formData = new FormData(this);
                                const serializedData = {};
                                formData.forEach((value, key) => {
                                    serializedData[key] = value;
                                });
                                sendEmail(serializedData, eventName, eventId);
                            });
                        }
            
                        const registrationModal = document.getElementById('registration-dialog');
                        if (registrationModal) {
                            registrationModal.style.display = 'block';
                        } else {
                            console.error('Element with id "registration-dialog" not found');
                        }
            
                    })
                    .catch(error => {
                        console.error('Error loading registration form:', error);
                    });
            }          
                                               
            let organizationOptions = '';
            function generateFormHtml(config, eventName, eventDate) {
                
                if (config.organizations && config.organizations.length > 0) {
                    organizationOptions = config.organizations.map(org => `<option value="${org}">${org}</option>`).join('');
                } else {
                    organizationOptions = '<option value="Other">Other</option>';
                }

                const showOtherOrganization = !config.organizations || (config.organizations.length === 1 && config.organizations[0] === 'Other');

                let organizationSelectHtml = `
                    <select id="organization" name="organization">
                        ${organizationOptions}
                    </select>
                `;

                if (showOtherOrganization) {
                    organizationSelectHtml += `
                        <input type="text" id="other-organization" name="otherOrganization" placeholder="Ievadiet jūsu organizāciju">
                    `;
                } else {
                    organizationSelectHtml += `
                        <input type="text" id="other-organization" name="otherOrganization" style="display: none;" placeholder="Ievadiet jūsu organizāciju">
                    `;
                }

                const licenseQuestionHtml = `
                    <div class="">
                        <label>
                            <input type="checkbox" id="has-license" name="hasLicense"> I have a license / Man ir licence
                        </label>
                    </div>
                `;

                const joinedCrewQuestion = `
                    <div class="">
                        <label>
                            <input type="checkbox" id="joined-crew" name="joinedCrew"> Joined crew / Apvienota ekipāža
                        </label>
                    </div>
                `;

                let boatClassOptions = '';
                if (config.boatClasses && config.boatClasses.length > 0) {
                    boatClassOptions = config.boatClasses.map(boatClass => `<option value="${boatClass.class}">${boatClass.class}</option>`).join('');
                }

                const coxswainInfoHtml = `
                    <div class="coxswain-info" id="coxswain-info">${getInitialCoxswainInfo(config.boatClasses)}</div>
                `;

                const formHtml = `
                    <form id="registration-form">
                        <div class="">
                            <label for="organization">Organization / Organizācija:</label>
                            ${organizationSelectHtml}
                        </div>
                        <div class="">
                            ${licenseQuestionHtml}
                        </div>
                        <div class="">
                            ${joinedCrewQuestion}
                        </div>
                        <div class="">
                            <label for="boat-class">Boat Class / Laivu klase:</label>
                            <select id="boat-class" name="boatClass" required>
                                ${boatClassOptions}
                            </select>
                        </div>
                        <div class="">
                            <label for="participants">Participants / Dalībnieki:</label>
                            ${coxswainInfoHtml}
                            <table id="participantsTable">
                                <thead>
                                    <tr id="participantsTableHeader">
                                        <th>Dzimšanas gads</th>
                                        <th>Vārds</th>
                                        <th>Uzvārds</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                            <div id="participant-info" class="participant-info"></div>
                        </div><br>
                        <div class="">
                            <label for="coach-information">Coach / Treneris <i>(Atsevišķus cilvēkus norādīt caur komatu)</i>: </label>
                            <input type="text" id="coach-information" name="coachInformation">
                        </div>
                        <div class="">
                            <label for="contact-information">Contact Information & Notes/ Kontaktinformācija & Piezīmes:</label>
                            <input type="text" id="contact-information" name="contactInformation" required>
                        </div>
                        <input type="hidden" id="given_name" name="given_name">
                        <input type="hidden" id="family_name" name="family_name">
                        <input type="hidden" id="nickname" name="nickname">
                        <input type="hidden" id="email" name="email">
                        <button type="submit">Submit</button>
                    </form>
                `;

                return formHtml;
            }

            function getInitialCoxswainInfo(boatClasses) {
                if (boatClasses.length > 0 && boatClasses[0].coxswainIndex !== undefined && boatClasses[0].coxswainName) {
                    const position = boatClasses[0].coxswainIndex + 1
                    return `${selectedClass.coxswainName} is marked in ${position} position.`;
                } else {
                    return '';
                }
            }

            function handleBoatClassChange(eventId, eventName, eventDate) {
                const category = document.getElementById('boat-class').value;
                const participantsTable = document.getElementById('participantsTable').getElementsByTagName('tbody')[0];
                const participantInfoDiv = document.getElementById('participant-info');
                participantsTable.innerHTML = '';
                participantInfoDiv.innerHTML = '';
            
                const selectedClass = boatClasses.find(boatClass => boatClass.class === category);
                const numParticipants = selectedClass ? selectedClass.participants : 1;
                const coxswainIndex = selectedClass ? selectedClass.coxswainIndex : -1;
            
                const hasLicenseCheckbox = document.getElementById('has-license');
                const joinedCrewCheckbox = document.getElementById('joined-crew');
                const headerRow = document.querySelector('#participantsTable thead tr');
            
                if (hasLicenseCheckbox.checked) {
                    headerRow.innerHTML = '<th>Licence</th>';
                    if (joinedCrewCheckbox.checked) {
                        headerRow.innerHTML += '<th>Organizācija</th>';
                    }
                } else {
                    headerRow.innerHTML = `
                        <th>Dzimšanas gads</th>
                        <th>Vārds</th>
                        <th>Uzvārds</th>
                        ${joinedCrewCheckbox.checked ? '<th>Organizācija</th>' : ''}
                    `;
                }
            
                for (let i = 0; i < numParticipants; i++) {
                    const newRow = participantsTable.insertRow();
                    if (hasLicenseCheckbox.checked) {
                        newRow.innerHTML = `
                            <td><input type="text" id="license${i + 1}" name="license${i + 1}" required oninput="fetchParticipantData(${i + 1}, '${eventId}', '${eventName}', '${eventDate}')"></td>
                        `;
                        if (joinedCrewCheckbox.checked) {
                            newRow.innerHTML += `
                                <td>
                                    <select id="participantOrganization${i + 1}" name="participantOrganization${i + 1}">
                                        ${organizationOptions}
                                    </select>
                                    <input type="text" id="other-participant-organization${i + 1}" name="otherParticipantOrganization${i + 1}" style="display: none;" placeholder="Enter other organization">
                                </td>
                            `;
                        }
                    } else {
                        newRow.innerHTML = `
                            <td><input type="number" id="birthYear${i + 1}" name="birthYear${i + 1}" required></td>
                            <td><input type="text" id="firstName${i + 1}" name="firstName${i + 1}" required></td>
                            <td><input type="text" id="lastName${i + 1}" name="lastName${i + 1}" required></td>
                            ${joinedCrewCheckbox.checked ? `
                                <td>
                                    <select id="participantOrganization${i + 1}" name="participantOrganization${i + 1}">
                                        ${organizationOptions}
                                    </select>
                                    <input type="text" id="other-participant-organization${i + 1}" name="otherParticipantOrganization${i + 1}" style="display: none;" placeholder="Enter other organization">
                                </td>
                            ` : ''}
                        `;
                    }
            
                    if (i === coxswainIndex) {
                        newRow.style.backgroundColor = 'rgba(237, 96, 0, 0.8)';
                    }
                }
            
                updateCoxswainInfo(selectedClass);
            }                                        
                                                                
            function updateCoxswainInfo(selectedClass) {
                const coxswainInfoParagraph = document.getElementById('coxswain-info');
                if (selectedClass && selectedClass.coxswainIndex !== undefined && selectedClass.coxswainName) {
                    const position = selectedClass.coxswainIndex + 1;
                    coxswainInfoParagraph.textContent = `${selectedClass.coxswainName} is marked in ${position} position.`;
                } else {
                    coxswainInfoParagraph.textContent = '';
                }
            }

            window.selectParticipant = function selectParticipant(index, lastName, firstName, birthYear) {
                const formattedParticipant = `${lastName.toUpperCase()} ${firstName} ${birthYear.toString().slice(-2)}`;
                const searchInput = document.getElementById(`license${index}`);
                if (searchInput) {
                    searchInput.value = formattedParticipant;
                }
                // Clear participant info div after selection
                const participantInfoDiv = document.getElementById('participant-info');
                participantInfoDiv.innerHTML = '';
            }
            

            window.fetchParticipantData = function fetchParticipantData(index, eventId, eventName, eventDate) {
                const searchInput = document.getElementById(`license${index}`);
                const searchQuery = searchInput ? searchInput.value.trim().toUpperCase() : '';
            
                console.log("Search query:", searchQuery);
                
                if (searchQuery) {
                    const fileUrl = `../entrySys/${encodeURIComponent(eventId)}___${encodeURIComponent(eventDate)}___${encodeURIComponent(eventName)}/licences.xlsx`;
                    console.log("Fetching licenses file from:", fileUrl);
                    
                    fetch(fileUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to fetch the licenses file');
                            }
                            return response.blob();
                        })
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onload = function(event) {
                                try {
                                    const data = event.target.result;
                                    const workbook = XLSX.read(data, { type: 'binary' });
                                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                                    const jsonData = XLSX.utils.sheet_to_json(sheet);
            
                                    const searchResults = jsonData.filter(p => {
                                        const licenseMatch = p['Licences numurs'] && p['Licences numurs'].toString().includes(searchQuery);
                                        const nameMatch = (p['Vārds'] && p['Vārds'].toUpperCase().includes(searchQuery)) || (p['Uzvārds'] && p['Uzvārds'].toUpperCase().includes(searchQuery));
                                        const clubMatch = p['Klubs'] && p['Klubs'].toUpperCase().includes(searchQuery);
                                        const birthYearMatch = p['Dzimšanas gads'] && p['Dzimšanas gads'].toString().includes(searchQuery);
            
                                        return licenseMatch || nameMatch || clubMatch || birthYearMatch;
                                    });
            
                                    const participantInfoDiv = document.getElementById('participant-info');
                                    participantInfoDiv.innerHTML = '';
            
                                    if (searchResults.length > 0) {
                                        const ul = document.createElement('ul');
                                        searchResults.forEach((p) => {
                                            const li = document.createElement('li');
                                            li.innerHTML = `
                                                ${p['Vārds']} ${p['Uzvārds']} | ${p['Dzimšanas gads']} | ${p['Klubs']}
                                                <button class="submit" onclick="selectParticipant(${index}, '${p['Uzvārds']}', '${p['Vārds']}', '${p['Dzimšanas gads']}')">Select</button>
                                            `;
                                            ul.appendChild(li);
                                        });
                                        participantInfoDiv.appendChild(ul);
                                    } else {
                                        participantInfoDiv.innerHTML = '<p>Šim vaicājumam nav pieejami dati.</p>';
                                    }
                                } catch (error) {
                                    console.error('Error processing Excel file:', error);
                                    document.getElementById('participant-info').innerHTML = '<p>Šim vaicājumam nav pieejami dati.</p>';
                                }
                            };
                            reader.readAsBinaryString(blob);
                        })
                        .catch(error => {
                            console.error('Error fetching participant data:', error);
                            document.getElementById('participant-info').innerHTML = '<p>Šim vaicājumam nav pieejami dati.</p>';
                        });
                } else {
                    document.getElementById('participant-info').innerHTML = '';
                }
            };                        
            
            async function loadLicenseMapping(eventId, eventName, eventDate) {
                try {
                    const response = await fetch(`../entrySys/${encodeURIComponent(eventId)}___${encodeURIComponent(eventDate)}___${encodeURIComponent(eventName)}/licences.xlsx`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch the licenses file');
                    }
            
                    const blob = await response.blob();
                    const reader = new FileReader();
            
                    return new Promise((resolve, reject) => {
                        reader.onload = function(event) {
                            try {
                                const data = event.target.result;
                                const workbook = XLSX.read(data, { type: 'binary' });
                                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                                const jsonData = XLSX.utils.sheet_to_json(sheet);
            
                                licenseMapping = jsonData.reduce((acc, item) => {
                                    if (item['Licences numurs']) {
                                        const birthYear = item['Dzimšanas gads'] ? item['Dzimšanas gads'].toString() : '';
                                        const lastName = item['Uzvārds'] ? item['Uzvārds'].toUpperCase() : '';
                                        const formatted = `${lastName} ${item['Vārds'] || ''} ${birthYear.slice(-2)}`;
                                        acc[item['Licences numurs']] = formatted;
                                    }
                                    return acc;
                                }, {});
            
                                resolve();
                            } catch (error) {
                                console.error('Error processing Excel file:', error);
                                reject('Error processing Excel file');
                            }
                        };
                        reader.onerror = function(error) {
                            console.error('Error reading the file:', error);
                            reject('Error reading the file');
                        };
                        reader.readAsBinaryString(blob);
                    });
                } catch (error) {
                    console.error('Error loading license mapping:', error);
                    throw new Error('Error loading license mapping');
                }
            }            

            async function sendEmail(formData, eventName, eventId) {
                try {
                    const eventDate = document.getElementById('dialog-title').textContent.split(' - ')[1].trim();
                    await loadLicenseMapping(eventId, eventName, eventDate);
                    const participants = Object.keys(formData)
                        .filter(key => key.startsWith('firstName') || key.startsWith('lastName') || key.startsWith('birthYear') || key.startsWith('license') || key.startsWith('participantOrganization') || key.startsWith('otherParticipantOrganization'))
                        .reduce((acc, key) => {
                            const [type, index] = key.match(/[a-zA-Z]+|[0-9]+/g);
                            if (!acc[index]) {
                                acc[index] = {};
                            }
                            acc[index][type] = formData[key];
                            return acc;
                        }, []);
                    if (!participants[0] || Object.keys(participants[0]).length === 0) {
                        participants.shift();
                    }
                    const formattedParticipants = participants.map(participant => {
                        const license = participant.license ? participant.license.trim() : '';
                        const birthYear = participant.birthYear ? participant.birthYear.toString() : '';
                        let formattedName = 'ERROR-EMPTY';
                        if (license) {
                            formattedName = license;
                        } else if (participant.firstName && participant.lastName && birthYear) {
                            const surname = participant.lastName.toUpperCase();
                            const name = participant.firstName.charAt(0).toUpperCase() + participant.firstName.slice(1);
                            const year = birthYear.slice(-2);
                            const organization = participant.participantOrganization && participant.participantOrganization !== 'Other' ? participant.participantOrganization : participant.otherParticipantOrganization;
                            formattedName = organization ? `${organization} / ${surname} ${name} ${year}` : `${surname} ${name} ${year}`;
                        }
                        return {
                            license: formattedName,
                            firstName: participant.firstName || '',
                            lastName: participant.lastName || '',
                            birthYear: birthYear
                        };
                    });
                    const dataToSend = {
                        eventId: eventId,
                        eventDate: eventDate,
                        eventName: eventName,
                        formData: {
                            boatClass: formData.boatClass,
                            contactInformation: formData.contactInformation,
                            coachInformation: formData.coachInformation,
                            organization: formData.organization,
                            otherOrganization: formData.otherOrganization,
                            participants: formattedParticipants
                        }
                    };
                    const response = await fetch('/submit-entry', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(dataToSend),
                    });
                    if (response.ok) {
                        showConfirmationModal(formData, formattedParticipants);
                    } else {
                        const errorText = await response.text();
                        console.error('Server response:', errorText);
                        throw new Error('Failed to submit entry');
                    }
                } catch (error) {
                    console.error("Error sending entry data:", error);
                    alert("Failed to submit entry: " + error.message);
                }
            }                                                          
            
            function showConfirmationModal(formData, formattedParticipants) {
                // Получаем элемент модального окна
                const modal = document.getElementById('confirmation-modal');
                const modalContent = document.querySelector('#confirmation-modal .dialog-box');
                
                // Заполняем модальное окно деталями
                modalContent.innerHTML = `
                    <h2><b>Reģistrācijas apstiprināšana</b></h2>
                    <h4>${formData.organization} - ${formData.boatClass}</h4><hr>
                    Dalībnieki:<br>
                        ${formattedParticipants.map(participant => `${participant.license}`).join('<br>')}
                    <hr>
                    Trenere - ${formData.coachInformation}<br>
                    Konktaktinformācija - ${formData.contactInformation}<br><hr>
                    Par izmaiņām ziņot <b>pieteiksanas@sportdss.eu</b><br>
                    <button class="dialog-modal-close">Close</button>
                `;
                
                // Отображаем модальное окно
                modal.style.display = 'flex';
                
                // Добавляем обработчик события для закрытия модального окна после добавления кнопки в DOM
                document.querySelector('.dialog-modal-close').addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }                                                                                           
        });

    const modal = document.getElementById('registration-modal');
    const closeModalBtn = document.getElementsByClassName('dialog-close')[0];

    closeModalBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    applyInactiveButtonStyles();

    function applyInactiveButtonStyles() {
        const inactiveButtons = document.querySelectorAll('.event-btn.inactive');

        inactiveButtons.forEach(button => {
            button.style.backgroundColor = '#ccc';
            button.style.color = '#666';
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
        });
    }
});
